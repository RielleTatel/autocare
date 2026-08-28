import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { purgeFixtures } from "./fixtures";
import { FAKE_WEBHOOK_SECRET, FakePspPayload } from "../src/modules/payments/fake-provider.adapter";

function sign(body: string): string {
  return createHmac("sha256", FAKE_WEBHOOK_SECRET).update(Buffer.from(body, "utf8")).digest("hex");
}

describe("subscriptions (e2e)", () => {
  let app: any, prisma: PrismaService;
  const basicCode = "E2E-SUB-BASIC";
  const premiumCode = "E2E-SUB-PREMIUM";
  const eliteCode = "E2E-SUB-ELITE";
  let basicPlanId: string, premiumPlanId: string, elitePlanId: string;
  let vehicleAId: string, vehicleBId: string;
  const uids = ["sub-owner-a", "sub-owner-b", "sub-mech", "sub-advisor"];

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    // rawBody: true is required for the real E_PAYMENT seam test below, which posts a signed
    // webhook through POST /webhooks/payments (same requirement as payments-webhook.e2e-spec.ts).
    app = mod.createNestApplication({ rawBody: true }); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);

    // Idempotent setup: clear anything a previously-aborted run left behind,
    // whose afterAll never got to execute.
    await purgeFixtures(prisma, { firebaseUids: ["sub-owner-a", "sub-owner-b", "sub-mech", "sub-advisor"],
      planCodes: ["E2E-SUB-BASIC"],
      plateNos: ["SUB0001", "SUB0002", "SUB0003", "SUB0004", "SUB0005", "SUB0006", "SUB0007", "SUB0008", "SUB0009"] });

    for (const [uid, role] of [["sub-owner-a", "MEMBER"], ["sub-owner-b", "MEMBER"], ["sub-mech", "MECHANIC"], ["sub-advisor", "ADVISOR"]] as const) {
      await prisma.user.create({ data: { firebaseUid: uid, role,
        consents: role === "MEMBER" ? { create: { policyVersion: "2026-08-privacy-v1" } } : undefined } });
    }

    const basic = await prisma.plan.create({ data: { code: basicCode, name: "Basic", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    const premium = await prisma.plan.create({ data: { code: premiumCode, name: "Premium", priceCentavos: 200000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    const elite = await prisma.plan.create({ data: { code: eliteCode, name: "Elite", priceCentavos: 50000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1,
      entitlements: { create: [{ entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 15000n }] } } });
    basicPlanId = basic.id; premiumPlanId = premium.id; elitePlanId = elite.id;

    const va = await prisma.vehicle.create({ data: { ownerUserId: (await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } })).id,
      plateNo: "SUB0001", make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000 } });
    const vb = await prisma.vehicle.create({ data: { ownerUserId: (await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-b" } })).id,
      plateNo: "SUB0002", make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000 } });
    vehicleAId = va.id; vehicleBId = vb.id;
  });

  afterAll(async () => {
    await prisma.entitlementUsage.deleteMany({ where: { subscription: { vehicleId: { in: [vehicleAId, vehicleBId] } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: { in: [vehicleAId, vehicleBId] } } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: { in: [vehicleAId, vehicleBId] } } } });
    await prisma.subscription.deleteMany({ where: { vehicleId: { in: [vehicleAId, vehicleBId] } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: [vehicleAId, vehicleBId] } } });
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: { in: [basicCode, premiumCode, eliteCode] } } } });
    await prisma.plan.deleteMany({ where: { code: { in: [basicCode, premiumCode, eliteCode] } } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
    await app.close();
  });

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);

  it("400 IDEMPOTENCY_KEY_REQUIRED when Idempotency-Key header is missing on POST /subscriptions", async () => {
    const res = await as("sub-owner-a").post("/api/v1/subscriptions")
      .send({ vehicleId: vehicleAId, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(400);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  let subscriptionId: string;
  it("creates a subscription: ACTIVE, lock-in set, first Invoice issued (FR-017..019)", async () => {
    const key = randomUUID();
    const res = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", key)
      .send({ vehicleId: vehicleAId, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(201);
    subscriptionId = res.body.data.id;
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.planId).toBe(basicPlanId);
    expect(new Date(res.body.data.lockInEndsAt).getTime()).toBeGreaterThan(new Date(res.body.data.startedAt).getTime());

    const invoice = await prisma.invoice.findFirst({ where: { subscriptionId }, include: { items: true } });
    expect(invoice).not.toBeNull();
    // Final review fix: the initial invoice must be advanced PAST INVOICE_ISSUED at creation
    // time (via nextState ISSUED) so it's actually payable — E_PAYMENT here -> AWAITING_AUTO_CHARGE.
    // Staying at INVOICE_ISSUED (the pre-fix bug) meant it could never be settled by either
    // the cash or auto-charge/webhook paths.
    expect(invoice!.status).toBe("AWAITING_AUTO_CHARGE");
    expect(invoice!.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(Number(invoice!.totalCentavos)).toBe(100000);
    expect(invoice!.items).toHaveLength(1);
  });

  it("replays the exact same response on a repeated Idempotency-Key without creating a second subscription", async () => {
    const key = randomUUID();
    const first = await as("sub-owner-b").post("/api/v1/subscriptions").set("Idempotency-Key", key)
      .send({ vehicleId: vehicleBId, planId: basicPlanId, paymentMethod: "COD" }).expect(201);
    const secondSubCount = await prisma.subscription.count({ where: { vehicleId: vehicleBId } });
    expect(secondSubCount).toBe(1);

    const replay = await as("sub-owner-b").post("/api/v1/subscriptions").set("Idempotency-Key", key)
      .send({ vehicleId: vehicleBId, planId: basicPlanId, paymentMethod: "COD" }).expect(200);
    expect(replay.headers["x-idempotent-replay"]).toBe("true");
    expect(replay.body.data.id).toBe(first.body.data.id);

    const stillOne = await prisma.subscription.count({ where: { vehicleId: vehicleBId } });
    expect(stillOne).toBe(1);

    // cleanup this extra subscription so it doesn't interfere with later "one active per vehicle" tests
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: vehicleBId } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: vehicleBId } } });
    await prisma.subscription.deleteMany({ where: { vehicleId: vehicleBId } });
  });

  it("rejects a second ACTIVE subscription for the same vehicle — 409 SUBSCRIPTION_ALREADY_ACTIVE", async () => {
    const res = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
      .send({ vehicleId: vehicleAId, planId: premiumPlanId, paymentMethod: "E_PAYMENT" }).expect(409);
    expect(res.body.error.code).toBe("SUBSCRIPTION_ALREADY_ACTIVE");
  });

  it("another member cannot subscribe someone else's vehicle — 403", async () => {
    await as("sub-owner-b").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
      .send({ vehicleId: vehicleAId, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(403);
  });

  it("GET /subscriptions lists the owner's subscriptions with plan summary", async () => {
    const res = await as("sub-owner-a").get("/api/v1/subscriptions").expect(200);
    const found = res.body.data.find((s: any) => s.id === subscriptionId);
    expect(found).toBeDefined();
    expect(found.plan.code).toBe(basicCode);
  });

  it("GET /subscriptions/:id is ownership-checked", async () => {
    await as("sub-owner-a").get(`/api/v1/subscriptions/${subscriptionId}`).expect(200);
    await as("sub-owner-b").get(`/api/v1/subscriptions/${subscriptionId}`).expect(403);
  });

  it("GET /subscriptions/:id/entitlements returns quota with usedQty 0 (no usage yet)", async () => {
    const created = await as("sub-owner-b").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
      .send({ vehicleId: vehicleBId, planId: elitePlanId, paymentMethod: "E_PAYMENT" }).expect(201);
    const subId = created.body.data.id;
    const res = await as("sub-owner-b").get(`/api/v1/subscriptions/${subId}/entitlements`).expect(200);
    expect(res.body.data).toEqual([{ entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 0, remaining: 2 }]);
  });

  it("upgrade: rejects a lower/equal-priced target — 422 SUBSCRIPTION_NOT_UPGRADE", async () => {
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/upgrade`)
      .send({ planId: basicPlanId }).expect(422);
    expect(res.body.error.code).toBe("SUBSCRIPTION_NOT_UPGRADE");
  });

  it("upgrade: pro-rates the delta, switches planId, issues a new invoice", async () => {
    const before = await prisma.invoice.count({ where: { subscriptionId } });
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/upgrade`)
      .send({ planId: premiumPlanId }).expect(201);
    expect(res.body.data.planId).toBe(premiumPlanId);
    expect(res.body.data.proratedChargeCentavos).toBeGreaterThan(0);
    const after = await prisma.invoice.count({ where: { subscriptionId } });
    expect(after).toBe(before + 1);
  });

  it("downgrade: rejects a higher/equal-priced target — 422 SUBSCRIPTION_NOT_DOWNGRADE", async () => {
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/downgrade`)
      .send({ planId: premiumPlanId }).expect(422);
    expect(res.body.error.code).toBe("SUBSCRIPTION_NOT_DOWNGRADE");
  });

  it("downgrade: flags pendingPlanId without switching planId immediately", async () => {
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/downgrade`)
      .send({ planId: basicPlanId }).expect(201);
    expect(res.body.data.pendingPlanId).toBe(basicPlanId);
    expect(res.body.data.planId).toBe(premiumPlanId); // unchanged until next cycle
  });

  it("cancellation-quote returns etfCentavos, lockInEndsAt, remainingMonths", async () => {
    const res = await as("sub-owner-a").get(`/api/v1/subscriptions/${subscriptionId}/cancellation-quote`).expect(200);
    expect(res.body.data.etfCentavos).toBeGreaterThan(0);
    expect(res.body.data.remainingMonths).toBeGreaterThan(0);
    expect(res.body.data.lockInEndsAt).toBeDefined();
  });

  it("cancel inside lock-in without acceptEtf — 409 SUBSCRIPTION_LOCKED_IN", async () => {
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/cancel`).send({}).expect(409);
    expect(res.body.error.code).toBe("SUBSCRIPTION_LOCKED_IN");
  });

  it("cancel inside lock-in with acceptEtf: issues ETF invoice and sets CANCELLED (BR-08)", async () => {
    const before = await prisma.invoice.count({ where: { subscriptionId } });
    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subscriptionId}/cancel`)
      .send({ acceptEtf: true }).expect(201);
    expect(res.body.data.status).toBe("CANCELLED");
    expect(res.body.data.etfCentavos).toBeGreaterThan(0);
    const after = await prisma.invoice.count({ where: { subscriptionId } });
    expect(after).toBe(before + 1);
  });

  it("cancel outside lock-in sets cancelRequestedAt and keeps status ACTIVE until period end", async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
    const vNoLockIn = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0003",
      make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
    const sub = await prisma.subscription.create({ data: {
      vehicleId: vNoLockIn.id, planId: basicPlanId, userId: owner.id, status: "ACTIVE",
      startedAt: new Date(), lockInEndsAt: new Date(Date.now() - 1000), // already elapsed
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      paymentMethod: "E_PAYMENT",
    } });

    const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${sub.id}/cancel`).send({}).expect(201);
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.cancelRequestedAt).not.toBeNull();

    await prisma.subscription.deleteMany({ where: { id: sub.id } });
    await prisma.vehicle.deleteMany({ where: { id: vNoLockIn.id } });
  });

  describe("real concurrency (race-condition fixes from code review)", () => {
    it("idempotency race guard: two truly concurrent requests with the SAME key create exactly one subscription and one invoice", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0004",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
      const key = randomUUID();
      const body = { vehicleId: v.id, planId: basicPlanId, paymentMethod: "E_PAYMENT" };

      const [r1, r2] = await Promise.all([
        as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", key).send(body),
        as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", key).send(body),
      ]);

      // One request wins the reservation race (201 Created); the other polls and replays (200).
      expect([r1.status, r2.status].sort()).toEqual([200, 201]);
      const winner = r1.status === 201 ? r1 : r2;
      const replay = r1.status === 201 ? r2 : r1;
      expect(replay.body.data.id).toBe(winner.body.data.id);

      const subCount = await prisma.subscription.count({ where: { vehicleId: v.id } });
      expect(subCount).toBe(1); // handler ran exactly once, not twice
      const invoiceCount = await prisma.invoice.count({ where: { subscription: { vehicleId: v.id } } });
      expect(invoiceCount).toBe(1);

      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: v.id } } } });
      await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: v.id } } });
      await prisma.subscription.deleteMany({ where: { vehicleId: v.id } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });

    it("one-ACTIVE-per-vehicle DB backstop: two truly concurrent requests with DIFFERENT keys for the same vehicle leave exactly one ACTIVE subscription", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0005",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
      const body = { vehicleId: v.id, planId: basicPlanId, paymentMethod: "E_PAYMENT" };

      const [r1, r2] = await Promise.all([
        as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID()).send(body),
        as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID()).send(body),
      ]);

      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]); // one created, one rejected — never two ACTIVE rows
      const rejected = r1.status === 409 ? r1 : r2;
      expect(rejected.body.error.code).toBe("SUBSCRIPTION_ALREADY_ACTIVE");

      const activeCount = await prisma.subscription.count({ where: { vehicleId: v.id, status: "ACTIVE" } });
      expect(activeCount).toBe(1);

      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId: v.id } } } });
      await prisma.invoice.deleteMany({ where: { subscription: { vehicleId: v.id } } });
      await prisma.subscription.deleteMany({ where: { vehicleId: v.id } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });
  });

  describe("status pre-check guards (Minor 2 — double-submit money-adjacent mint)", () => {
    it("cancel on an already-CANCELLED subscription — 409 SUBSCRIPTION_ALREADY_CANCELLED, no second ETF invoice", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0008",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
      const created = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
        .send({ vehicleId: v.id, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(201);
      const subId = created.body.data.id;

      const first = await as("sub-owner-a").post(`/api/v1/subscriptions/${subId}/cancel`).send({ acceptEtf: true }).expect(201);
      expect(first.body.data.status).toBe("CANCELLED");
      const invoiceCountAfterFirst = await prisma.invoice.count({ where: { subscriptionId: subId } });

      const second = await as("sub-owner-a").post(`/api/v1/subscriptions/${subId}/cancel`).send({ acceptEtf: true }).expect(409);
      expect(second.body.error.code).toBe("SUBSCRIPTION_ALREADY_CANCELLED");

      const invoiceCountAfterSecond = await prisma.invoice.count({ where: { subscriptionId: subId } });
      expect(invoiceCountAfterSecond).toBe(invoiceCountAfterFirst); // no second ETF invoice minted

      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscriptionId: subId } } });
      await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
      await prisma.subscription.deleteMany({ where: { id: subId } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });

    it("upgrade on a CANCELLED subscription — 409 SUBSCRIPTION_NOT_ACTIVE, no second pro-rated invoice", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0009",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
      const created = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
        .send({ vehicleId: v.id, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(201);
      const subId = created.body.data.id;
      await as("sub-owner-a").post(`/api/v1/subscriptions/${subId}/cancel`).send({ acceptEtf: true }).expect(201);
      const invoiceCountAfterCancel = await prisma.invoice.count({ where: { subscriptionId: subId } });

      const res = await as("sub-owner-a").post(`/api/v1/subscriptions/${subId}/upgrade`).send({ planId: premiumPlanId }).expect(409);
      expect(res.body.error.code).toBe("SUBSCRIPTION_NOT_ACTIVE");

      const invoiceCountAfterUpgradeAttempt = await prisma.invoice.count({ where: { subscriptionId: subId } });
      expect(invoiceCountAfterUpgradeAttempt).toBe(invoiceCountAfterCancel); // no pro-rated invoice minted

      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscriptionId: subId } } });
      await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
      await prisma.subscription.deleteMany({ where: { id: subId } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });
  });

  // Whole-branch review Critical fix: prove the INITIAL invoice created by a real subscribe
  // (not a hand-seeded AWAITING_* fixture, which is what every other spec uses) is actually
  // payable end-to-end. Before the fix it was left at INVOICE_ISSUED forever.
  describe("initial invoice is payable end-to-end (whole-branch review Critical fix)", () => {
    it("real COD subscribe -> cash payment against the first invoice settles it to PAID and the subscription to ACTIVE", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const advisor = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-advisor" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0006",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });

      const created = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
        .send({ vehicleId: v.id, planId: basicPlanId, paymentMethod: "COD" }).expect(201);
      const subId = created.body.data.id;

      const invoice = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: subId } });
      expect(invoice.status).toBe("AWAITING_CASH");

      // Open a shift for this test's advisor if one isn't already open (earlier cash specs run
      // in a separate app instance/db-scoped user, so this advisor never has one yet).
      const openShift = await prisma.cashShift.findFirst({ where: { userId: advisor.id, closedAt: null } });
      if (!openShift) {
        await as("sub-advisor").post("/api/v1/cash-shifts/open").expect(201);
      }

      const pay = await as("sub-advisor").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
        .send({ invoiceId: invoice.id, amountTendered: Number(invoice.totalCentavos), clientUuid: randomUUID() }).expect(201);
      expect(pay.body.data.paymentId).toBeDefined();

      const settledInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(settledInvoice.status).toBe("PAID");
      const settledSub = await prisma.subscription.findUniqueOrThrow({ where: { id: subId } });
      expect(settledSub.status).toBe("ACTIVE");

      const shift = await prisma.cashShift.findFirstOrThrow({ where: { userId: advisor.id, closedAt: null } });
      await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.cashShift.deleteMany({ where: { id: shift.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscriptionId: subId } } });
      await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
      await prisma.subscription.deleteMany({ where: { id: subId } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });

    it("real E_PAYMENT subscribe -> webhook success settles the first invoice to PAID and the subscription to ACTIVE", async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "sub-owner-a" } });
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "SUB0007",
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });

      const created = await as("sub-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
        .send({ vehicleId: v.id, planId: basicPlanId, paymentMethod: "E_PAYMENT" }).expect(201);
      const subId = created.body.data.id;

      const invoice = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: subId } });
      expect(invoice.status).toBe("AWAITING_AUTO_CHARGE");

      const payload: FakePspPayload = {
        eventId: `evt-sub-e2e-${invoice.id}`, type: "payment.paid", pspReference: "pay-sub-e2e-1",
        invoiceId: invoice.id, amountCentavos: Number(invoice.totalCentavos), succeeded: true,
      };
      const body = JSON.stringify(payload);
      await request(app.getHttpServer())
        .post("/api/v1/webhooks/payments")
        .set("Content-Type", "application/json")
        .set("paymongo-signature", sign(body))
        .send(body)
        .expect(200);

      const settledInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(settledInvoice.status).toBe("PAID");
      const settledSub = await prisma.subscription.findUniqueOrThrow({ where: { id: subId } });
      expect(settledSub.status).toBe("ACTIVE");
      const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
      expect(payments).toHaveLength(1);
      expect(payments[0].status).toBe("SUCCEEDED");

      await prisma.pspWebhookEvent.deleteMany({ where: { eventId: payload.eventId } });
      await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { subscriptionId: subId } } });
      await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
      await prisma.subscription.deleteMany({ where: { id: subId } });
      await prisma.vehicle.deleteMany({ where: { id: v.id } });
    });
  });
});
