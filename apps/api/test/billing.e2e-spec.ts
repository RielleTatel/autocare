import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { BillingService } from "../src/modules/billing/billing.service";
import { WebhooksProcessor } from "../src/modules/payments/webhooks.processor";
import { PROVIDER_PORT, ProviderPort, PspEvent } from "../src/modules/payments/provider.port";
import { FakePspPayload } from "../src/modules/payments/fake-provider.adapter";
import { CLOCK, Clock } from "../src/common/clock/clock";

/** Test double for the injected clock — mutable so a single test can walk a multi-day timeline. */
class FakeClock implements Clock {
  constructor(public date: Date) {}
  now(): Date {
    return this.date;
  }
}

/** Always throws on createCheckout — used to deterministically drive the E-payment retry walk without depending on real network/PSP behavior. */
class AlwaysFailProviderAdapter implements ProviderPort {
  async createCheckout(): Promise<{ checkoutUrl: string; pspRef: string }> {
    throw new Error("simulated provider failure");
  }
  verifyWebhook(): PspEvent {
    throw new Error("not used in this test");
  }
  mapEvent(raw: unknown): PspEvent {
    return raw as PspEvent;
  }
  async refund(): Promise<{ refundRef: string }> {
    return { refundRef: "n/a" };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Anchor at mid-day UTC (= 8pm Manila) — well clear of the Manila midnight boundary, so
// `day0 + N*DAY_MS` always lands on the intended Manila calendar day N.
const day0 = new Date(Date.UTC(2026, 0, 1, 4, 0, 0));
const day = (n: number) => new Date(day0.getTime() + n * DAY_MS);

describe("billing jobs (e2e)", () => {
  let app: any, prisma: PrismaService, billing: BillingService, webhooksProcessor: WebhooksProcessor, clock: FakeClock;
  const planCode = "E2E-BILL-PLAN";
  const downgradePlanCode = "E2E-BILL-DOWNGRADE-PLAN";
  const elitePlanCode = "E2E-BILL-ELITE-PLAN";
  const uid = "bill-owner";
  let planId: string, downgradePlanId: string, elitePlanId: string;
  const vehicleIds: string[] = [];
  let plateCounter = 0;

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    clock = new FakeClock(day0);
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .overrideProvider(CLOCK).useValue(clock)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    billing = app.get(BillingService);
    webhooksProcessor = app.get(WebhooksProcessor);

    await prisma.user.create({ data: { firebaseUid: uid, role: "MEMBER", consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
    const plan = await prisma.plan.create({ data: { code: planCode, name: "Bill Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    planId = plan.id;
    const downgradePlan = await prisma.plan.create({ data: { code: downgradePlanCode, name: "Downgrade Plan", priceCentavos: 50000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    downgradePlanId = downgradePlan.id;
    const elitePlan = await prisma.plan.create({
      data: {
        code: elitePlanCode, name: "Elite Plan", priceCentavos: 150000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1,
        entitlements: { create: [{ entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 15000n }] },
      },
    });
    elitePlanId = elitePlan.id;
  });

  afterAll(async () => {
    await prisma.pspWebhookEvent.deleteMany({ where: { provider: "paymongo", eventId: { startsWith: "evt-bill-" } } });
    await prisma.payment.deleteMany({ where: { invoice: { subscription: { vehicleId: { in: vehicleIds } } } } });
    await prisma.entitlementUsage.deleteMany({ where: { subscription: { vehicleId: { in: vehicleIds } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: { in: vehicleIds } } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: { in: vehicleIds } } } });
    await prisma.subscription.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: { in: [planCode, downgradePlanCode, elitePlanCode] } } } });
    await prisma.plan.deleteMany({ where: { code: { in: [planCode, downgradePlanCode, elitePlanCode] } } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: uid } } });
    await prisma.user.deleteMany({ where: { firebaseUid: uid } });
    await app.close();
  });

  async function makeVehicle() {
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: uid } });
    plateCounter += 1;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerUserId: owner.id, plateNo: `BILL${String(plateCounter).padStart(4, "0")}`,
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000,
      },
    });
    vehicleIds.push(vehicle.id);
    return vehicle;
  }

  async function makeSubscription(opts: {
    paymentMethod: "E_PAYMENT" | "COD";
    planId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    pendingPlanId?: string | null;
    cancelRequestedAt?: Date | null;
  }) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: uid } });
    const vehicle = await makeVehicle();
    const sub = await prisma.subscription.create({
      data: {
        vehicleId: vehicle.id, planId: opts.planId ?? planId, userId: owner.id, status: "ACTIVE",
        startedAt: day0, lockInEndsAt: day(365),
        currentPeriodStart: opts.currentPeriodStart ?? day0,
        currentPeriodEnd: opts.currentPeriodEnd ?? day(30),
        paymentMethod: opts.paymentMethod,
        pendingPlanId: opts.pendingPlanId ?? null,
        cancelRequestedAt: opts.cancelRequestedAt ?? null,
      },
    });
    return { sub, vehicle };
  }

  async function makeInvoice(subscriptionId: string, status: string, dueDate: Date, opts: { chargeAttempts?: number; firstFailedAt?: Date | null } = {}) {
    return prisma.invoice.create({
      data: {
        subscriptionId, number: `INV-BILLTEST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        totalCentavos: 100000n, status: status as any, dueDate,
        chargeAttempts: opts.chargeAttempts ?? 0, firstFailedAt: opts.firstFailedAt ?? null,
      },
    });
  }

  describe("20-day COD non-payment timeline (subscription.evaluateStates)", () => {
    it("walks AWAITING_CASH -> (d1) GRACE -> (d8) PAST_DUE -> (d15) SUSPENDED, mirrored on subscription.status, and stays SUSPENDED through d20", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "COD" });
      const invoice = await makeInvoice(sub.id, "AWAITING_CASH", day0);

      // subscription.status mirrors invoice.status via subscriptionStatusFor — AWAITING_CASH maps
      // to the generic ACTIVE subscription status (there's no "AWAITING_CASH" subscription status);
      // GRACE/PAST_DUE/SUSPENDED map 1:1 by name.
      const expectedInvoiceByDay: Record<number, string> = {
        0: "AWAITING_CASH", 1: "GRACE", 7: "GRACE", 8: "PAST_DUE", 14: "PAST_DUE", 15: "SUSPENDED", 20: "SUSPENDED",
      };
      const expectedSubByDay: Record<number, string> = {
        0: "ACTIVE", 1: "GRACE", 7: "GRACE", 8: "PAST_DUE", 14: "PAST_DUE", 15: "SUSPENDED", 20: "SUSPENDED",
      };

      for (let d = 0; d <= 20; d += 1) {
        clock.date = day(d);
        await billing.evaluateStates();
        if (expectedInvoiceByDay[d] !== undefined) {
          const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
          const updatedSub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
          expect(updatedInvoice.status).toBe(expectedInvoiceByDay[d]);
          expect(updatedSub.status).toBe(expectedSubByDay[d]);
        }
      }
    });
  });

  describe("no double invoice on billing.issueInvoices re-run (same day)", () => {
    it("issues exactly one invoice per subscription+period even when run twice", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "E_PAYMENT", currentPeriodEnd: day0 });
      clock.date = day0;

      await billing.issueInvoices();
      await billing.issueInvoices();

      const invoices = await prisma.invoice.findMany({ where: { subscriptionId: sub.id } });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe("AWAITING_AUTO_CHARGE");
      expect(invoices[0].dueDate.getTime()).toBe(day0.getTime());

      const updatedSub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updatedSub.currentPeriodStart.getTime()).toBe(day0.getTime());
    });
  });

  describe("entitlements.resetCycle", () => {
    it("seeds fresh usage rows at the cycle boundary", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "E_PAYMENT", planId: elitePlanId, currentPeriodEnd: day0 });
      clock.date = day0;

      await billing.resetCycle();

      const usage = await prisma.entitlementUsage.findMany({ where: { subscriptionId: sub.id, periodStart: day0 } });
      expect(usage).toHaveLength(1);
      expect(usage[0].entitlementType).toBe("INSPECTION");
      expect(usage[0].usedQty).toBe(0);
    });
  });

  describe("flagged downgrade applied at period boundary", () => {
    it("swaps planId <- pendingPlanId and clears pendingPlanId once currentPeriodEnd is reached", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "E_PAYMENT", currentPeriodEnd: day0, pendingPlanId: downgradePlanId });
      clock.date = day0;

      await billing.evaluateStates();

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updated.planId).toBe(downgradePlanId);
      expect(updated.pendingPlanId).toBeNull();
    });
  });

  describe("deferred cancellation finalized at period end", () => {
    it("flips status to CANCELLED once currentPeriodEnd is reached", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "E_PAYMENT", currentPeriodEnd: day0, cancelRequestedAt: day0 });
      clock.date = day0;

      await billing.evaluateStates();

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updated.status).toBe("CANCELLED");
    });
  });

  describe("webhooks.retryUnprocessed (Task 6 handoff)", () => {
    it("picks up an unprocessed PspWebhookEvent row, fully processes it, and a re-run does not double-apply", async () => {
      const { sub } = await makeSubscription({ paymentMethod: "E_PAYMENT" });
      const invoice = await makeInvoice(sub.id, "AWAITING_AUTO_CHARGE", day0);

      const payload: FakePspPayload = {
        eventId: `evt-bill-${invoice.id}`, type: "payment.paid", pspReference: "pay-bill-retry-1",
        invoiceId: invoice.id, amountCentavos: 100000, succeeded: true,
      };
      const row = await prisma.pspWebhookEvent.create({ data: { provider: "paymongo", eventId: payload.eventId, rawPayload: payload as any } });
      expect(row.processedAt).toBeNull();

      await webhooksProcessor.process({ name: "retryUnprocessed" } as any);

      const afterFirst = await prisma.pspWebhookEvent.findUniqueOrThrow({ where: { id: row.id } });
      expect(afterFirst.processedAt).not.toBeNull();
      expect(afterFirst.attempts).toBe(1);
      const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(updatedInvoice.status).toBe("PAID");
      const paymentsAfterFirst = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
      expect(paymentsAfterFirst).toHaveLength(1);

      // Re-run: the row is already processedAt-set, so it must not be picked up / reprocessed again.
      await webhooksProcessor.process({ name: "retryUnprocessed" } as any);

      const paymentsAfterSecond = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
      expect(paymentsAfterSecond).toHaveLength(1);
      const afterSecond = await prisma.pspWebhookEvent.findUniqueOrThrow({ where: { id: row.id } });
      expect(afterSecond.attempts).toBe(1); // not re-claimed
    });
  });
});

describe("billing jobs — E-payment retry walk (e2e, always-failing provider)", () => {
  let app: any, prisma: PrismaService, billing: BillingService, clock: FakeClock;
  const planCode = "E2E-BILL-RETRY-PLAN";
  const uid = "bill-retry-owner";
  let planId: string;
  const vehicleIds: string[] = [];

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    clock = new FakeClock(day0);
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .overrideProvider(CLOCK).useValue(clock)
      .overrideProvider(PROVIDER_PORT).useClass(AlwaysFailProviderAdapter)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    billing = app.get(BillingService);

    await prisma.user.create({ data: { firebaseUid: uid, role: "MEMBER", consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
    const plan = await prisma.plan.create({ data: { code: planCode, name: "Retry Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    planId = plan.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoice: { subscription: { vehicleId: { in: vehicleIds } } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: { in: vehicleIds } } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: { in: vehicleIds } } } });
    await prisma.subscription.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.plan.deleteMany({ where: { code: planCode } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: uid } } });
    await prisma.user.deleteMany({ where: { firebaseUid: uid } });
    await app.close();
  });

  it("autoCharge fails -> RETRYING; retryFailed retries only on days 1/3/7; 3rd failure -> PAST_DUE", async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: uid } });
    const vehicle = await prisma.vehicle.create({
      data: { ownerUserId: owner.id, plateNo: "BRTY0001", make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000 },
    });
    vehicleIds.push(vehicle.id);
    const sub = await prisma.subscription.create({
      data: {
        vehicleId: vehicle.id, planId, userId: owner.id, status: "ACTIVE",
        startedAt: day0, lockInEndsAt: day(365), currentPeriodStart: day0, currentPeriodEnd: day(30), paymentMethod: "E_PAYMENT",
      },
    });
    const invoice = await prisma.invoice.create({
      data: { subscriptionId: sub.id, number: `INV-BRTY-${Date.now()}`, totalCentavos: 100000n, status: "AWAITING_AUTO_CHARGE", dueDate: day0 },
    });

    // Day 0: billing.autoCharge — the provider always throws, so PaymentsService.autoCharge
    // records chargeAttempts=1/firstFailedAt and BillingService fires CHARGE_FAILED -> RETRYING.
    clock.date = day0;
    await billing.autoCharge();
    let updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("RETRYING");
    expect(updated.chargeAttempts).toBe(1);
    expect(updated.firstFailedAt).not.toBeNull();

    // Day 1 relative to firstFailedAt: retryFailed retries (2nd failure) -> stays RETRYING.
    clock.date = new Date(updated.firstFailedAt!.getTime() + 1 * DAY_MS);
    await billing.retryFailed();
    // Re-running the SAME day must not double-retry.
    await billing.retryFailed();
    updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("RETRYING");
    expect(updated.chargeAttempts).toBe(2);

    // Day 2 (not a RETRY_DAYS day): no retry.
    clock.date = new Date(updated.firstFailedAt!.getTime() + 2 * DAY_MS);
    await billing.retryFailed();
    updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.chargeAttempts).toBe(2);

    // Day 3: retryFailed retries (3rd failure) -> PAST_DUE.
    clock.date = new Date(updated.firstFailedAt!.getTime() + 3 * DAY_MS);
    await billing.retryFailed();
    updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("PAST_DUE");
    expect(updated.chargeAttempts).toBe(3);
    const updatedSub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updatedSub.status).toBe("PAST_DUE");

    // Day 7 (RETRY_DAYS day) — but the invoice is already PAST_DUE, so retryFailed no longer
    // selects it at all (it only queries status "RETRYING").
    clock.date = new Date(updated.firstFailedAt!.getTime() + 7 * DAY_MS);
    await billing.retryFailed();
    updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("PAST_DUE");
    expect(updated.chargeAttempts).toBe(3);
  });
});
