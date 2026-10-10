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
    subscription: { id: "subscription-1", vehicleId: "vehicle-1" },
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
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice), update: jest.fn() },
    payment: { create: jest.fn() },
    subscription: { update: jest.fn() },
    pspWebhookEvent: { update: jest.fn() },
  };
  const prisma = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
    pspWebhookEvent: { create: jest.fn().mockResolvedValue({ id: "webhook-1" }) },
    $transaction: jest.fn((callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
  };
  const vehicles = { findForUser: jest.fn().mockResolvedValue({ id: "vehicle-1" }) };
  const provider = {
    createCheckout: jest.fn().mockResolvedValue({ checkoutUrl: "https://checkout.paymongo.com/test", pspRef: "checkout-1" }),
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
        checkoutUrl: "https://checkout.paymongo.com/test",
      });

      expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "read");
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

      expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "read");
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("preserves the ownership rejection even when another member's invoice is paid", async () => {
      const { service, vehicles, provider } = setup(makeInvoice("PAID"));
      const denied = new DomainError("FORBIDDEN_ROLE", "You cannot access this vehicle", 403);
      vehicles.findForUser.mockRejectedValue(denied);

      await expect(service.createIntent(user, "invoice-1")).rejects.toBe(denied);

      expect(provider.createCheckout).not.toHaveBeenCalled();
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
      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: "invoice-1" },
        data: { status: "PAID", chargeAttempts: 0, firstFailedAt: null },
      });
      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { id: "subscription-1" }, data: { status: "ACTIVE" },
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
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.subscription.update).not.toHaveBeenCalled();
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
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.subscription.update).not.toHaveBeenCalled();
    });

    it("does not create a second payment for a new event referencing an already paid invoice", async () => {
      const { service, tx } = setup(makeInvoice("PAID"));

      await expect(service.handleWebhook(makeEvent())).resolves.toEqual({ alreadyProcessed: false });

      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.subscription.update).not.toHaveBeenCalled();
      expect(tx.pspWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" }, data: { processedAt: expect.any(Date) },
      });
    });
  });
});
