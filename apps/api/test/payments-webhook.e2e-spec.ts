import { Test } from "@nestjs/testing";
import request from "supertest";
import { createHmac } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { FAKE_WEBHOOK_SECRET, FakePspPayload } from "../src/modules/payments/fake-provider.adapter";

function sign(body: string): string {
  return createHmac("sha256", FAKE_WEBHOOK_SECRET).update(Buffer.from(body, "utf8")).digest("hex");
}

describe("webhooks/payments (e2e)", () => {
  let app: any, prisma: PrismaService;
  const planCode = "E2E-PAY-PLAN";
  const uid = "pay-owner";
  let planId: string;
  // Each fixture subscription needs its own vehicle: "one ACTIVE subscription per vehicle" is a
  // DB-level unique constraint (subscriptions_one_active_per_vehicle), so reusing a vehicle
  // across fixtures collides.
  const vehicleIds: string[] = [];
  let plateCounter = 0;

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({ data: { firebaseUid: uid, role: "MEMBER", consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
    const plan = await prisma.plan.create({ data: { code: planCode, name: "Pay Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
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

  async function makeSubscriptionWithInvoice(status: "AWAITING_AUTO_CHARGE" | "RETRYING", chargeAttempts = 0) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: uid } });
    plateCounter += 1;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerUserId: owner.id, plateNo: `PAY${String(plateCounter).padStart(4, "0")}`,
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000,
      },
    });
    vehicleIds.push(vehicle.id);
    const sub = await prisma.subscription.create({
      data: {
        vehicleId: vehicle.id, planId, userId: owner.id, status: "ACTIVE",
        startedAt: new Date(), lockInEndsAt: new Date(Date.now() + 30 * 86400000),
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        paymentMethod: "E_PAYMENT",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: sub.id, number: `INV-TEST-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        totalCentavos: 100000n, status, dueDate: new Date(), chargeAttempts,
      },
    });
    return { sub, invoice, vehicle };
  }

  function postWebhook(payload: FakePspPayload) {
    const body = JSON.stringify(payload);
    return request(app.getHttpServer())
      .post("/api/v1/webhooks/payments")
      .set("Content-Type", "application/json")
      .set("paymongo-signature", sign(body))
      .send(body);
  }

  it("bad signature -> 401 WEBHOOK_SIGNATURE_INVALID", async () => {
    const payload: FakePspPayload = { eventId: "evt-bad-sig", type: "payment.paid", pspReference: "pay-x", succeeded: true };
    const res = await request(app.getHttpServer())
      .post("/api/v1/webhooks/payments")
      .set("Content-Type", "application/json")
      .set("paymongo-signature", "deadbeef")
      .send(JSON.stringify(payload))
      .expect(401);
    expect(res.body.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("success event: AWAITING_AUTO_CHARGE invoice -> PAID, subscription ACTIVE, one SUCCEEDED Payment", async () => {
    const { sub, invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
    const payload: FakePspPayload = {
      eventId: `evt-success-${invoice.id}`, type: "payment.paid", pspReference: "pay-success-1",
      invoiceId: invoice.id, amountCentavos: 100000, succeeded: true,
    };

    await postWebhook(payload).expect(200);

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("PAID");
    const updatedSub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updatedSub.status).toBe("ACTIVE");
    const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("SUCCEEDED");
    expect(payments[0].pspReference).toBe("pay-success-1");
  });

  it("idempotency: the SAME event posted twice creates exactly ONE Payment and advances the invoice once; second call is a 200 no-op", async () => {
    const { invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
    const payload: FakePspPayload = {
      eventId: `evt-idem-${invoice.id}`, type: "payment.paid", pspReference: "pay-idem-1",
      invoiceId: invoice.id, amountCentavos: 100000, succeeded: true,
    };

    const first = await postWebhook(payload).expect(200);
    expect(first.body.data.alreadyProcessed).toBe(false);

    const second = await postWebhook(payload).expect(200);
    expect(second.body.data.alreadyProcessed).toBe(true);

    const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);

    const events = await prisma.pspWebhookEvent.findMany({ where: { eventId: payload.eventId } });
    expect(events).toHaveLength(1);
    expect(events[0].processedAt).not.toBeNull();

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("PAID");
  });

  it("failed event: AWAITING_AUTO_CHARGE invoice -> RETRYING, chargeAttempts incremented, firstFailedAt set, Payment FAILED", async () => {
    const { invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
    const payload: FakePspPayload = {
      eventId: `evt-fail-${invoice.id}`, type: "payment.failed", pspReference: "pay-fail-1",
      invoiceId: invoice.id, amountCentavos: 100000, succeeded: false,
    };

    await postWebhook(payload).expect(200);

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("RETRYING");
    expect(updatedInvoice.chargeAttempts).toBe(1);
    expect(updatedInvoice.firstFailedAt).not.toBeNull();

    const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("FAILED");
  });

  it("failed event on the 3rd RETRYING attempt -> PAST_DUE (Ruling BIGSTATE threshold)", async () => {
    const { invoice } = await makeSubscriptionWithInvoice("RETRYING", 2);
    const payload: FakePspPayload = {
      eventId: `evt-pastdue-${invoice.id}`, type: "payment.failed", pspReference: "pay-fail-3",
      invoiceId: invoice.id, amountCentavos: 100000, succeeded: false,
    };

    await postWebhook(payload).expect(200);

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("PAST_DUE");
    expect(updatedInvoice.chargeAttempts).toBe(3);
  });

  describe("POST /payments/intents", () => {
    it("400 IDEMPOTENCY_KEY_REQUIRED when Idempotency-Key header is missing", async () => {
      const { invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/intents")
        .set("Authorization", `Bearer ${uid}`)
        .send({ invoiceId: invoice.id })
        .expect(400);
      expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("returns a checkoutUrl from the fake provider adapter for the invoice's owner", async () => {
      const { invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/intents")
        .set("Authorization", `Bearer ${uid}`)
        .set("Idempotency-Key", `intent-${invoice.id}`)
        .send({ invoiceId: invoice.id })
        .expect(201);
      expect(res.body.data.checkoutUrl).toContain(invoice.id);
    });

    it("403s a non-owner", async () => {
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: "pay-other" } } });
      await prisma.user.deleteMany({ where: { firebaseUid: "pay-other" } });
      await prisma.user.create({ data: { firebaseUid: "pay-other", role: "MEMBER", consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
      try {
        const { invoice } = await makeSubscriptionWithInvoice("AWAITING_AUTO_CHARGE");
        await request(app.getHttpServer())
          .post("/api/v1/payments/intents")
          .set("Authorization", "Bearer pay-other")
          .set("Idempotency-Key", `intent-other-${invoice.id}`)
          .send({ invoiceId: invoice.id })
          .expect(403);
      } finally {
        await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: "pay-other" } } });
        await prisma.user.deleteMany({ where: { firebaseUid: "pay-other" } });
      }
    });
  });
});
