import { Prisma } from "@prisma/client";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { DomainError } from "../../common/errors/domain-error";
import type { PrismaService } from "../prisma/prisma.service";
import type { VehiclesService } from "../vehicles/vehicles.service";
import { PaymentsService } from "./payments.service";
import type { ProviderPort, PspEvent } from "./provider.port";

const user: AbilityUser = { id: "member-1", role: "MEMBER" };

function makeInvoice(status = "AWAITING_AUTO_CHARGE") {
  return {
    id: "invoice-1",
    number: "INV-2026-000001",
    totalCentavos: 89900n,
    status,
    chargeAttempts: 0,
    firstFailedAt: null,
    subscriptionId: "subscription-1",
    workOrderId: null as string | null,
    subscription: { id: "subscription-1", vehicleId: "vehicle-1", status: "ACTIVE", paymentMethod: "E_PAYMENT" },
  };
}

function makeEvent(overrides: Partial<PspEvent> = {}): PspEvent {
  return {
    eventId: "event-1",
    type: "checkout_session.payment.paid",
    pspReference: "payment-1",
    invoiceId: "invoice-1",
    amountCentavos: 89900,
    succeeded: true,
    raw: { event: "test" },
    ...overrides,
  };
}

function setup(invoice = makeInvoice()) {
  const tx = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    payment: { create: jest.fn() },
    subscription: { updateMany: jest.fn() },
    pspWebhookEvent: { update: jest.fn() },
  };
  const prisma = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
    auditLog: { findFirst: jest.fn().mockResolvedValue({ after: { kind: "INITIAL_SUBSCRIPTION", subscriptionId: "subscription-1" } }) },
    pspWebhookEvent: { create: jest.fn().mockResolvedValue({ id: "webhook-1" }), findUnique: jest.fn().mockResolvedValue({ id: "webhook-1", processedAt: new Date(), rawPayload: {} }) },
    $transaction: jest.fn((callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
  };
  const vehicles = { findForUser: jest.fn().mockResolvedValue({ id: "vehicle-1" }) };
  const provider = {
    createCheckout: jest.fn().mockResolvedValue({ checkoutUrl: "https://checkout.paymongo.com/test", pspRef: "checkout-1" }),
    mapEvent: jest.fn().mockReturnValue(makeEvent()),
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    vehicles as unknown as VehiclesService,
    provider as unknown as ProviderPort,
  );
  return { service, prisma, tx, vehicles, provider };
}

describe("PaymentsService (unit, mocked Prisma)", () => {
  describe("createIntent", () => {
    it("checks vehicle access before requesting an unpaid invoice's checkout", async () => {
      const { service, vehicles, provider } = setup();

      await expect(service.createIntent(user, "invoice-1")).resolves.toEqual({
        checkoutUrl: "https://checkout.paymongo.com/test", invoiceId: "invoice-1", sandbox: true,
      });

      expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "update");
      expect(provider.createCheckout).toHaveBeenCalledWith({
        id: "invoice-1", totalCentavos: 89900, description: "Invoice INV-2026-000001",
      });
      expect(vehicles.findForUser.mock.invocationCallOrder[0]).toBeLessThan(
        provider.createCheckout.mock.invocationCallOrder[0],
      );
    });

    it("rejects a settled invoice without creating another checkout", async () => {
      const { service, vehicles, provider } = setup(makeInvoice("PAID"));

      await expect(service.createIntent(user, "invoice-1")).rejects.toMatchObject({
        code: "INVOICE_ALREADY_PAID", httpStatus: 409,
      });

      expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "update");
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("preserves the ownership rejection even when another member's invoice is paid", async () => {
      const { service, vehicles, provider } = setup(makeInvoice("PAID"));
      const denied = new DomainError("FORBIDDEN_ROLE", "You cannot access this vehicle", 403);
      vehicles.findForUser.mockRejectedValue(denied);

      await expect(service.createIntent(user, "invoice-1")).rejects.toBe(denied);

      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it.each(["COD", "CANCELLED", "WORK_ORDER", "UNMARKED", "ETF"])("rejects unsupported %s invoices without requesting checkout", async (kind) => {
      const invoice = makeInvoice();
      if (kind === "COD") invoice.subscription.paymentMethod = "COD";
      if (kind === "CANCELLED") invoice.subscription.status = "CANCELLED";
      if (kind === "WORK_ORDER") invoice.workOrderId = "work-order-1";
      const { service, provider, prisma } = setup(invoice);
      if (kind === "UNMARKED") prisma.auditLog.findFirst.mockResolvedValue(null);
      if (kind === "ETF") prisma.auditLog.findFirst.mockResolvedValue({ after: { kind: "EARLY_TERMINATION", subscriptionId: "subscription-1" } });
      await expect(service.createIntent(user, "invoice-1")).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 422 });
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("a failed checkout request leaves the same invoice available for a new attempt", async () => {
      const { service, provider, prisma } = setup();
      provider.createCheckout.mockRejectedValueOnce(new Error("provider unavailable"));
      await expect(service.createIntent(user, "invoice-1")).rejects.toThrow("provider unavailable");
      await expect(service.createIntent(user, "invoice-1")).resolves.toHaveProperty("invoiceId", "invoice-1");
      expect(prisma.invoice.findUnique).toHaveBeenCalledTimes(2);
      expect(provider.createCheckout.mock.calls[0][0].id).toBe(provider.createCheckout.mock.calls[1][0].id);
    });

    it("rejects an unknown invoice without contacting the provider", async () => {
      const { service, prisma, vehicles, provider } = setup();
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.createIntent(user, "missing")).rejects.toMatchObject({
        code: "FORBIDDEN_ROLE", httpStatus: 404,
      });

      expect(vehicles.findForUser).not.toHaveBeenCalled();
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhook", () => {
    it.each(["CARD", "GCASH", "MAYA"] as const)("records the verified %s payment method and amount", async (method) => {
      const { service, tx } = setup();

      await expect(service.handleWebhook(makeEvent({ method }))).resolves.toEqual({ alreadyProcessed: false });

      expect(tx.payment.create).toHaveBeenCalledWith({
        data: {
          invoiceId: "invoice-1", method, amountCentavos: 89900n,
          status: "SUCCEEDED", pspReference: "payment-1", clientUuid: "event-1",
        },
      });
      expect(tx.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: "invoice-1", status: "AWAITING_AUTO_CHARGE", chargeAttempts: 0 },
        data: { status: "PAID", chargeAttempts: 0, firstFailedAt: null },
      });
      expect(tx.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: "subscription-1", status: { not: "CANCELLED" } }, data: { status: "ACTIVE" },
      });
      expect(tx.pspWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" }, data: { processedAt: expect.any(Date) },
      });
    });

    it("keeps the legacy fake-provider fallback when method and amount are absent", async () => {
      const { service, tx } = setup();

      await service.handleWebhook(makeEvent({ method: undefined, amountCentavos: undefined }));

      expect(tx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ method: "CARD", amountCentavos: 89900n }),
      });
    });

    it.each([
      ["underpayment", 89899],
      ["overpayment", 89901],
      ["zero", 0],
      ["negative", -89900],
      ["fractional", 89900.5],
      ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
      ["NaN", Number.NaN],
      ["infinite", Number.POSITIVE_INFINITY],
    ])("leaves a successful event with %s amount unprocessed without settling", async (_case, amount) => {
      const { service, prisma, tx } = setup();

      await expect(service.handleWebhook(makeEvent({ amountCentavos: amount as number }))).rejects.toMatchObject({
        code: "PAYMENT_FAILED", httpStatus: 422,
      });

      expect(prisma.pspWebhookEvent.create).toHaveBeenCalledTimes(1);
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
      expect(tx.subscription.updateMany).not.toHaveBeenCalled();
      expect(tx.pspWebhookEvent.update).not.toHaveBeenCalled();
    });

    it("does not settle twice when inserting the same event hits Prisma's unique constraint", async () => {
      const { service, prisma, tx } = setup();
      prisma.pspWebhookEvent.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Duplicate event", { code: "P2002", clientVersion: "5.19.0" }),
      );

      await expect(service.handleWebhook(makeEvent())).resolves.toEqual({ alreadyProcessed: true });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
      expect(tx.subscription.updateMany).not.toHaveBeenCalled();
    });

    it("re-reads a competing success and does not record another successful payment", async () => {
      const { service, tx } = setup();
      tx.invoice.updateMany.mockResolvedValueOnce({ count: 0 });
      tx.invoice.findUnique.mockResolvedValueOnce(makeInvoice()).mockResolvedValueOnce(makeInvoice("PAID"));
      await service.handleWebhook(makeEvent());
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.subscription.updateMany).not.toHaveBeenCalled();
      expect(tx.pspWebhookEvent.update).toHaveBeenCalled();
      expect(tx.invoice.findUnique).toHaveBeenCalledTimes(2);
    });

    it("does not discard a verified success when a failed charge won the first transition", async () => {
      const { service, tx } = setup();
      tx.invoice.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
      tx.invoice.findUnique.mockResolvedValueOnce(makeInvoice()).mockResolvedValueOnce({ ...makeInvoice("RETRYING"), chargeAttempts: 1 });
      await service.handleWebhook(makeEvent());
      expect(tx.invoice.updateMany).toHaveBeenLastCalledWith({ where: { id: "invoice-1", status: "RETRYING", chargeAttempts: 1 }, data: { status: "PAID", chargeAttempts: 1, firstFailedAt: null } });
      expect(tx.payment.create).toHaveBeenCalledTimes(1);
      expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "SUCCEEDED" }) });
      expect(tx.pspWebhookEvent.update).toHaveBeenCalledTimes(1);
    });

    it("leaves an event pending instead of losing it when all bounded CAS attempts conflict", async () => {
      const { service, tx } = setup();
      tx.invoice.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.handleWebhook(makeEvent())).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 409 });
      expect(tx.invoice.findUnique).toHaveBeenCalledTimes(5);
      expect(tx.pspWebhookEvent.update).not.toHaveBeenCalled();
      expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it("reprocesses the stored verified payload when a provider redelivers an unprocessed event", async () => {
      const { service, prisma, provider, tx } = setup();
      prisma.pspWebhookEvent.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Duplicate event", { code: "P2002", clientVersion: "5" }));
      const storedRaw = { original: "signed event" };
      prisma.pspWebhookEvent.findUnique.mockResolvedValue({ id: "webhook-1", processedAt: null, rawPayload: storedRaw });
      await expect(service.handleWebhook(makeEvent())).resolves.toEqual({ alreadyProcessed: true });
      expect(provider.mapEvent).toHaveBeenCalledWith(storedRaw);
      expect(tx.payment.create).toHaveBeenCalledTimes(1);
      expect(tx.pspWebhookEvent.update).toHaveBeenCalledTimes(1);
    });

    it("does not create a second payment for a new event referencing an already paid invoice", async () => {
      const { service, tx } = setup(makeInvoice("PAID"));

      await expect(service.handleWebhook(makeEvent())).resolves.toEqual({ alreadyProcessed: false });

      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
      expect(tx.subscription.updateMany).not.toHaveBeenCalled();
      expect(tx.pspWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" }, data: { processedAt: expect.any(Date) },
      });
    });
  });
});
