import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { purgeFixtures } from "./fixtures";

describe("cash — COD payments, shifts, remittance (e2e)", () => {
  let app: any, prisma: PrismaService;
  const uids = ["cash-advisor-a", "cash-advisor-b", "cash-admin", "cash-member"];
  let advisorAId: string, advisorBId: string, memberId: string;
  const invoiceNumbers: string[] = [];
  const vehicleIds: string[] = [];
  const subscriptionIds: string[] = [];
  let basicPlanId: string;
  const basicCode = "E2E-CASH-BASIC";

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);

    // Idempotent setup: clear anything a previously-aborted run left behind,
    // whose afterAll never got to execute.
    await purgeFixtures(prisma, { firebaseUids: uids, planCodes: [basicCode] });

    for (const [uid, role] of [
      ["cash-advisor-a", "ADVISOR"], ["cash-advisor-b", "ADVISOR"], ["cash-admin", "ADMIN"], ["cash-member", "MEMBER"],
    ] as const) {
      await prisma.user.create({ data: { firebaseUid: uid, role, name: uid,
        consents: role === "MEMBER" ? { create: { policyVersion: "2026-08-privacy-v1" } } : undefined } });
    }
    advisorAId = (await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "cash-advisor-a" } })).id;
    advisorBId = (await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "cash-advisor-b" } })).id;
    memberId = (await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "cash-member" } })).id;

    const plan = await prisma.plan.create({ data: { code: basicCode, name: "Basic", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    basicPlanId = plan.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoice: { number: { in: invoiceNumbers } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { number: { in: invoiceNumbers } } } });
    await prisma.invoice.deleteMany({ where: { number: { in: invoiceNumbers } } });
    await prisma.entitlementUsage.deleteMany({ where: { subscription: { id: { in: subscriptionIds } } } });
    await prisma.subscription.deleteMany({ where: { id: { in: subscriptionIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.plan.deleteMany({ where: { code: basicCode } });
    await prisma.cashShift.deleteMany({ where: { userId: { in: [advisorAId, advisorBId] } } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
    await app.close();
  });

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);

  const makeInvoice = async (status: "AWAITING_CASH" | "GRACE", totalCentavos = 100000, subscriptionId?: string) => {
    const number = `INV-CASH-${randomUUID().slice(0, 8)}`;
    invoiceNumbers.push(number);
    const invoice = await prisma.invoice.create({
      data: { number, totalCentavos: BigInt(totalCentavos), status, dueDate: new Date(), subscriptionId },
    });
    return invoice;
  };

  it("opens a cash shift for the current advisor", async () => {
    const res = await as("cash-advisor-a").post("/api/v1/cash-shifts/open").expect(201);
    expect(res.body.data.userId).toBe(advisorAId);
    expect(res.body.data.closedAt).toBeNull();
  });

  it("rejects a double-open — 409 SHIFT_ALREADY_OPEN", async () => {
    const res = await as("cash-advisor-a").post("/api/v1/cash-shifts/open").expect(409);
    expect(res.body.error.code).toBe("SHIFT_ALREADY_OPEN");
  });

  it("a non-counter role (MEMBER) cannot open a shift — 403 FORBIDDEN_ROLE", async () => {
    const res = await as("cash-member").post("/api/v1/cash-shifts/open").expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("POST /payments/cash without an open shift — 409 NO_OPEN_SHIFT", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const res = await as("cash-advisor-b").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() }).expect(409);
    expect(res.body.error.code).toBe("NO_OPEN_SHIFT");
  });

  it("amount tendered < total — 422 CASH_TENDER_INSUFFICIENT", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const res = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 50000, clientUuid: randomUUID() }).expect(422);
    expect(res.body.error.code).toBe("CASH_TENDER_INSUFFICIENT");
  });

  it("records a CASH payment, advances invoice to PAID, computes change — and flips subscription to ACTIVE", async () => {
    const vehicle = await prisma.vehicle.create({ data: { ownerUserId: memberId, plateNo: `CASH${randomUUID().slice(0, 4).toUpperCase()}`,
      make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000 } });
    vehicleIds.push(vehicle.id);
    const sub = await prisma.subscription.create({ data: {
      vehicleId: vehicle.id, planId: basicPlanId, userId: memberId, status: "GRACE",
      startedAt: new Date(), lockInEndsAt: new Date(Date.now() + 86400000 * 180),
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
      paymentMethod: "COD",
    } });
    subscriptionIds.push(sub.id);
    const invoice = await makeInvoice("GRACE", 100000, sub.id);

    const res = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 120000, clientUuid: randomUUID() }).expect(201);
    expect(res.body.data.changeCentavos).toBe(20000);
    expect(res.body.data.paymentId).toBeDefined();

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("PAID");
    const updatedSub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updatedSub.status).toBe("ACTIVE");

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.body.data.paymentId } });
    expect(payment.method).toBe("CASH");
    expect(payment.status).toBe("SUCCEEDED");
    expect(payment.collectedByUserId).toBe(advisorAId);
    expect(Number(payment.amountCentavos)).toBe(100000);
  });

  it("idempotent replay via the same Idempotency-Key returns the same payment, no double-settle", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const key = randomUUID();
    const body = { invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() };

    const first = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", key).send(body).expect(201);
    const replay = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", key).send(body).expect(200);
    expect(replay.headers["x-idempotent-replay"]).toBe("true");
    expect(replay.body.data.paymentId).toBe(first.body.data.paymentId);

    const count = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(count).toBe(1);
  });

  it("idempotent replay via the same clientUuid (different Idempotency-Key — offline retry) returns the existing payment", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const clientUuid = randomUUID();
    const body = { invoiceId: invoice.id, amountTendered: 100000, clientUuid };

    const first = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID()).send(body).expect(201);
    const replay = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID()).send(body).expect(201);
    expect(replay.body.data.paymentId).toBe(first.body.data.paymentId);
    // clientUuid replay cannot reconstruct the ORIGINAL amountTendered (not persisted on
    // Payment) — documented choice is to return 0 rather than a value derived from this
    // replay request's amountTendered (which may legitimately differ from the original).
    expect(replay.body.data.changeCentavos).toBe(0);

    const count = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(count).toBe(1);
  });

  it("rejects a cash payment on an ALREADY-PAID invoice with a fresh clientUuid — 409 INVOICE_ALREADY_PAID, no double-settle", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const first = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() }).expect(201);
    expect(first.body.data.paymentId).toBeDefined();

    // Same invoice, brand-new clientUuid AND Idempotency-Key — a genuinely distinct request,
    // not a replay of the first. Must be rejected, not create a second Payment.
    const second = await as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() }).expect(409);
    expect(second.body.error.code).toBe("INVOICE_ALREADY_PAID");

    const count = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(count).toBe(1);
  });

  it("concurrency: two distinct cash-payment requests racing on the same invoice settle it exactly once", async () => {
    const invoice = await makeInvoice("AWAITING_CASH");
    const bodyA = { invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() };
    const bodyB = { invoiceId: invoice.id, amountTendered: 100000, clientUuid: randomUUID() };

    const [r1, r2] = await Promise.all([
      as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID()).send(bodyA),
      as("cash-advisor-a").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID()).send(bodyB),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const rejected = r1.status === 409 ? r1 : r2;
    expect(rejected.body.error.code).toBe("INVOICE_ALREADY_PAID");

    const count = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(count).toBe(1);
    const settledInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(settledInvoice.status).toBe("PAID");
  });

  it("closes the shift and computes variance = counted − expected (owner-only)", async () => {
    const shift = await prisma.cashShift.findFirstOrThrow({ where: { userId: advisorAId, closedAt: null } });

    const expectedAgg = await prisma.payment.aggregate({
      where: { shiftId: shift.id, method: "CASH", status: "SUCCEEDED" }, _sum: { amountCentavos: true },
    });
    const expected = Number(expectedAgg._sum.amountCentavos ?? 0n);

    await as("cash-advisor-b").post(`/api/v1/cash-shifts/${shift.id}/close`).send({ countedCentavos: expected }).expect(403);

    const res = await as("cash-advisor-a").post(`/api/v1/cash-shifts/${shift.id}/close`)
      .send({ countedCentavos: expected - 500 }).expect(201);
    expect(res.body.data.expectedCentavos).toBe(expected);
    expect(res.body.data.countedCentavos).toBe(expected - 500);
    expect(res.body.data.varianceCentavos).toBe(-500);
    expect(res.body.data.closedAt).not.toBeNull();
  });

  it("rejects closing an already-closed shift — 409 SHIFT_ALREADY_CLOSED", async () => {
    const shift = await prisma.cashShift.findFirstOrThrow({ where: { userId: advisorAId }, orderBy: { openedAt: "desc" } });
    const res = await as("cash-advisor-a").post(`/api/v1/cash-shifts/${shift.id}/close`).send({ countedCentavos: 0 }).expect(409);
    expect(res.body.error.code).toBe("SHIFT_ALREADY_CLOSED");
  });

  it("GET /admin/reports/remittance reconciles a day with mixed cash across 2 staff", async () => {
    // advisor-a already has one closed shift with known variance from the test above.
    // advisor-b: open shift, one cash payment, close with an exact count (zero variance).
    await as("cash-advisor-b").post("/api/v1/cash-shifts/open").expect(201);
    const invoice = await makeInvoice("AWAITING_CASH", 75000);
    await as("cash-advisor-b").post("/api/v1/payments/cash").set("Idempotency-Key", randomUUID())
      .send({ invoiceId: invoice.id, amountTendered: 75000, clientUuid: randomUUID() }).expect(201);
    const shiftB = await prisma.cashShift.findFirstOrThrow({ where: { userId: advisorBId, closedAt: null } });
    await as("cash-advisor-b").post(`/api/v1/cash-shifts/${shiftB.id}/close`).send({ countedCentavos: 75000 }).expect(201);

    const today = new Date().toISOString().slice(0, 10);
    const res = await as("cash-admin").get(`/api/v1/admin/reports/remittance?date=${today}`).expect(200);
    const rows: any[] = res.body.data;
    const rowA = rows.find((r) => r.staffUserId === advisorAId);
    const rowB = rows.find((r) => r.staffUserId === advisorBId);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowB.systemTotalCentavos).toBe(75000);
    expect(rowB.countedCentavos).toBe(75000);
    expect(rowB.varianceCentavos).toBe(0);
    expect(rowB.shiftCount).toBe(1);
    expect(rowA.varianceCentavos).toBe(-500);
  });

  it("remittance report is admin-only — 403 for ADVISOR", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await as("cash-advisor-a").get(`/api/v1/admin/reports/remittance?date=${today}`).expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
