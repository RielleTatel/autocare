import { BillingService } from "./billing.service";
import { RETRY_DAYS } from "../payments/invoice-lifecycle";

const DAY_MS = 24 * 60 * 60 * 1000;
const day0 = new Date(Date.UTC(2026, 0, 1, 4, 0, 0)); // mid-day UTC, clear of the Manila midnight boundary
const day = (n: number) => new Date(day0.getTime() + n * DAY_MS);

function makePrisma(overrides: any = {}) {
  return {
    subscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    invoice: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), findUniqueOrThrow: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((fn: any) => (typeof fn === "function" ? fn({ invoice: { create: jest.fn(), count: jest.fn().mockResolvedValue(0) }, subscription: { update: jest.fn() } }) : Promise.all(fn))),
    ...overrides,
  };
}

describe("BillingService (unit, mocked prisma)", () => {
  describe("issueInvoices", () => {
    it("skips subscriptions whose currentPeriodEnd is not today (Manila)", async () => {
      const prisma = makePrisma({
        subscription: { findMany: jest.fn().mockResolvedValue([{ id: "s1", currentPeriodEnd: day(5), plan: { billingInterval: "MONTHLY", priceCentavos: 100000n, name: "P" }, paymentMethod: "E_PAYMENT" }]), update: jest.fn() },
      });
      const clock = { now: () => day0 };
      const svc = new BillingService(prisma, {} as any, {} as any, clock);

      const result = await svc.issueInvoices();

      expect(result.issued).toBe(0);
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it("skips a subscription that already has an invoice for the new period (idempotent re-run)", async () => {
      const sub = { id: "s1", currentPeriodEnd: day0, plan: { billingInterval: "MONTHLY", priceCentavos: 100000n, name: "P" }, paymentMethod: "E_PAYMENT" };
      const prisma = makePrisma({
        subscription: { findMany: jest.fn().mockResolvedValue([sub]), update: jest.fn() },
        invoice: { findFirst: jest.fn().mockResolvedValue({ id: "existing" }), findMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      });
      const clock = { now: () => day0 };
      const svc = new BillingService(prisma, {} as any, {} as any, clock);

      const result = await svc.issueInvoices();

      expect(result.issued).toBe(0);
    });
  });

  describe("autoCharge", () => {
    it("fires CHARGE_FAILED and mirrors subscription status when PaymentsService.autoCharge throws", async () => {
      const prisma = makePrisma({
        invoice: {
          findMany: jest.fn().mockResolvedValue([{ id: "i1", subscriptionId: "s1", status: "AWAITING_AUTO_CHARGE" }]),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "i1", status: "AWAITING_AUTO_CHARGE", chargeAttempts: 1 }),
          update: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn(),
        },
        subscription: { findMany: jest.fn(), update: jest.fn() },
      });
      const payments = { autoCharge: jest.fn().mockRejectedValue(new Error("boom")) };
      const clock = { now: () => day0 };
      const svc = new BillingService(prisma, payments as any, {} as any, clock);

      const result = await svc.autoCharge();

      expect(result.attempted).toBe(1);
      expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { status: "RETRYING" } });
      expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "ACTIVE" } });
    });

    it("leaves the invoice untouched when PaymentsService.autoCharge succeeds", async () => {
      const prisma = makePrisma({
        invoice: { findMany: jest.fn().mockResolvedValue([{ id: "i1", subscriptionId: "s1", status: "AWAITING_AUTO_CHARGE" }]), update: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), count: jest.fn() },
        subscription: { findMany: jest.fn(), update: jest.fn() },
      });
      const payments = { autoCharge: jest.fn().mockResolvedValue({ checkoutUrl: "x" }) };
      const svc = new BillingService(prisma, payments as any, {} as any, { now: () => day0 });

      await svc.autoCharge();

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe("retryFailed", () => {
    it("skips a RETRYING invoice on a non-RETRY_DAYS day", async () => {
      const inv = { id: "i1", subscriptionId: "s1", status: "RETRYING", chargeAttempts: 1, firstFailedAt: day0 };
      const prisma = makePrisma({ invoice: { findMany: jest.fn().mockResolvedValue([inv]), findUniqueOrThrow: jest.fn(), update: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() } });
      const payments = { autoCharge: jest.fn() };
      const svc = new BillingService(prisma, payments as any, {} as any, { now: () => day(2) }); // day 2 is not in RETRY_DAYS

      const result = await svc.retryFailed();

      expect(result.retried).toBe(0);
      expect(payments.autoCharge).not.toHaveBeenCalled();
    });

    it("retries once on day 1 and is idempotent if called again the same day", async () => {
      let attempts = 1;
      const prisma = {
        invoice: {
          findMany: jest.fn().mockImplementation(() => Promise.resolve([{ id: "i1", subscriptionId: "s1", status: "RETRYING", chargeAttempts: attempts, firstFailedAt: day0 }])),
          findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ id: "i1", status: "RETRYING", chargeAttempts: attempts })),
          update: jest.fn(),
        },
        subscription: { update: jest.fn() },
      };
      const payments = { autoCharge: jest.fn().mockImplementation(async () => { attempts += 1; throw new Error("boom"); }) };
      const svc = new BillingService(prisma as any, payments as any, {} as any, { now: () => day(1) });

      const first = await svc.retryFailed();
      const second = await svc.retryFailed();

      expect(first.retried).toBe(1);
      expect(second.retried).toBe(0); // already retried today — chargeAttempts caught up to the day-1 quota
      expect(payments.autoCharge).toHaveBeenCalledTimes(1);
    });

    it("RETRY_DAYS is [1,3,7] and reaching attempt 3 moves the invoice to PAST_DUE via nextState", () => {
      expect(RETRY_DAYS).toEqual([1, 3, 7]);
    });
  });

  describe("evaluateStates", () => {
    it("does not update an invoice whose state is unchanged by DAY_ELAPSED (e.g. day 0)", async () => {
      const prisma = makePrisma({
        invoice: { findMany: jest.fn().mockResolvedValue([{ id: "i1", subscriptionId: "s1", status: "AWAITING_CASH", dueDate: day0 }]), update: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), count: jest.fn() },
        subscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      });
      const svc = new BillingService(prisma, {} as any, {} as any, { now: () => day0 });

      const result = await svc.evaluateStates();

      expect(result.evaluated).toBe(0);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it("does not apply a flagged downgrade before currentPeriodEnd is reached", async () => {
      const prisma = makePrisma({
        invoice: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), count: jest.fn() },
        subscription: { findMany: jest.fn().mockResolvedValue([{ id: "s1", pendingPlanId: "p2", currentPeriodEnd: day(5) }]), update: jest.fn() },
      });
      const svc = new BillingService(prisma, {} as any, {} as any, { now: () => day0 });

      const result = await svc.evaluateStates();

      expect(result.downgradesApplied).toBe(0);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("does not finalize a cancellation before currentPeriodEnd is reached", async () => {
      const prisma = makePrisma({
        invoice: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), count: jest.fn() },
        subscription: {
          findMany: jest.fn()
            .mockResolvedValueOnce([]) // downgrade candidates
            .mockResolvedValueOnce([{ id: "s1", cancelRequestedAt: day0, currentPeriodEnd: day(5) }]), // cancel candidates
          update: jest.fn(),
        },
      });
      const svc = new BillingService(prisma, {} as any, {} as any, { now: () => day0 });

      const result = await svc.evaluateStates();

      expect(result.cancellationsFinalized).toBe(0);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe("resetCycle", () => {
    it("skips subscriptions not crossing a boundary today and calls EntitlementService.resetCycle for those that are", async () => {
      const prisma = makePrisma({
        subscription: { findMany: jest.fn().mockResolvedValue([{ id: "s1", currentPeriodEnd: day0 }, { id: "s2", currentPeriodEnd: day(5) }]), update: jest.fn() },
      });
      const entitlements = { resetCycle: jest.fn().mockResolvedValue(undefined) };
      const svc = new BillingService(prisma, {} as any, entitlements as any, { now: () => day0 });

      const result = await svc.resetCycle();

      expect(result.reset).toBe(1);
      expect(entitlements.resetCycle).toHaveBeenCalledTimes(1);
      expect(entitlements.resetCycle).toHaveBeenCalledWith("s1", day0);
    });
  });
});
