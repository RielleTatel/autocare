import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RedisService } from "../src/common/redis/redis.service";

const TAG = `appt-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";
const DATE = "2027-03-01"; // far-future dateOverride, distinct from other suites

describe("appointments — book/entitlement/race (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let redis: RedisService;
  let serviceTypeId: string;
  let bayId: string;
  let subAId: string;
  const mechId = randomUUID();

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);

  const seedVehicleWithSub = async (memberUid: string, quantityPerCycle: number) => {
    const member = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: memberUid } });
    const vehicle = await prisma.vehicle.create({
      data: { ownerUserId: member.id, plateNo: `AP${randomUUID().slice(0, 5).toUpperCase()}`, make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 },
    });
    const plan = await prisma.plan.create({
      data: {
        code: `${TAG}-P${quantityPerCycle}`, name: "Appt Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1,
        entitlements: { create: [{ entitlementType: "INSPECTION", quantityPerCycle, overagePriceCentavos: 15000n }] },
      },
    });
    const now = new Date();
    const sub = await prisma.subscription.create({
      data: {
        vehicleId: vehicle.id, planId: plan.id, userId: member.id, status: "ACTIVE",
        startedAt: now, lockInEndsAt: new Date(now.getTime() + 180 * 86400000),
        currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000), paymentMethod: "E_PAYMENT",
      },
    });
    return { vehicleId: vehicle.id, subId: sub.id };
  };

  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });

    await prisma.user.create({ data: { firebaseUid: `${TAG}-mA`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    await prisma.user.create({ data: { firebaseUid: `${TAG}-mB`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    await prisma.user.create({ data: { id: mechId, firebaseUid: `${TAG}-mech`, role: "MECHANIC" } });

    const st = await prisma.serviceType.create({
      data: { code: `${TAG}-INSP`, name: "Inspection", standardDurationMin: 60, requiredSkills: ["OIL"], priceCentavos: 50000n, entitlementType: "INSPECTION" },
    });
    serviceTypeId = st.id;
    const bay = await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } });
    bayId = bay.id;
    await prisma.operatingHours.create({ data: { dateOverride: DATE, openTime: "09:00", closeTime: "17:00", walkInBufferPct: 0 } });
    await prisma.staffShift.create({ data: { userId: mechId, date: DATE, startTime: "09:00", endTime: "17:00", skills: ["OIL"] } });

    ({ subId: subAId } = await seedVehicleWithSub(`${TAG}-mA`, 5));
  });

  afterAll(async () => {
    try {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await redis.client.scan(cursor, "MATCH", `hold:${bayId}:*`, "COUNT", 200);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== "0");
      if (keys.length) await redis.client.del(...keys);

      const vehIds = (await prisma.vehicle.findMany({ where: { owner: { firebaseUid: { startsWith: TAG } } }, select: { id: true } })).map((v) => v.id);
      await prisma.appointment.deleteMany({ where: { vehicleId: { in: vehIds } } });
      await prisma.entitlementUsage.deleteMany({ where: { subscription: { vehicleId: { in: vehIds } } } });
      await prisma.subscription.deleteMany({ where: { vehicleId: { in: vehIds } } });
      await prisma.vehicle.deleteMany({ where: { id: { in: vehIds } } });
      await prisma.planEntitlement.deleteMany({ where: { plan: { code: { startsWith: TAG } } } });
      await prisma.plan.deleteMany({ where: { code: { startsWith: TAG } } });
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });
      await prisma.serviceBay.deleteMany({ where: { id: bayId } });
      await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const slots = async () =>
    (await as(`${TAG}-mA`).get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`).expect(200)).body.data;

  const holdFor = async (uid: string, slot: { bayId: string; start: string }) =>
    (await as(uid).post("/api/v1/scheduling/holds").send({ bayId: slot.bayId, start: slot.start, serviceTypeId }).expect(201)).body.data.holdId;

  it("books a held slot and consumes an entitlement (FR-044, FR-045)", async () => {
    const [slot0] = await slots();
    const holdId = await holdFor(`${TAG}-mA`, slot0);
    const vehId = (await prisma.subscription.findUniqueOrThrow({ where: { id: subAId }, select: { vehicleId: true } })).vehicleId;

    const res = await as(`${TAG}-mA`).post("/api/v1/appointments").send({ holdId, vehicleId: vehId, serviceTypeId, requiresPickup: false }).expect(201);
    expect(res.body.data.status).toBe("BOOKED");

    const ent = await as(`${TAG}-mA`).get(`/api/v1/subscriptions/${subAId}/entitlements`).expect(200);
    const insp = ent.body.data.find((r: any) => r.entitlementType === "INSPECTION");
    expect(insp.usedQty).toBe(1);
    expect(insp.remaining).toBe(4);
  });

  it("two concurrent books on one hold: exactly one wins, other 409 (FR-043)", async () => {
    const list = await slots();
    const slot = list[0]; // slot0 was booked → this is the next free one
    const holdId = await holdFor(`${TAG}-mA`, slot);
    const vehId = (await prisma.subscription.findUniqueOrThrow({ where: { id: subAId }, select: { vehicleId: true } })).vehicleId;
    const body = { holdId, vehicleId: vehId, serviceTypeId, requiresPickup: false };

    const [a, b] = await Promise.all([
      as(`${TAG}-mA`).post("/api/v1/appointments").send(body),
      as(`${TAG}-mA`).post("/api/v1/appointments").send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("booking with the entitlement exhausted returns 402 with an overage price", async () => {
    const { subId } = await seedVehicleWithSub(`${TAG}-mB`, 0); // quantity 0 → always exhausted
    const vehId = (await prisma.subscription.findUniqueOrThrow({ where: { id: subId }, select: { vehicleId: true } })).vehicleId;
    const list = await slots();
    const slot = list[0];
    const holdId = await holdFor(`${TAG}-mB`, slot);

    const res = await as(`${TAG}-mB`).post("/api/v1/appointments").send({ holdId, vehicleId: vehId, serviceTypeId, requiresPickup: false }).expect(402);
    expect(res.body.error.code).toBe("ENTITLEMENT_EXHAUSTED");
    expect(res.body.error.details.overagePriceCentavos).toBe(15000);
  });
});
