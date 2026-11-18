import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RedisService } from "../src/common/redis/redis.service";
import { seedChecklist } from "../prisma/seed-checklist";

const TAG = `jrn-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";
const DATE = new Date(Date.now() + (365 + Math.floor(Math.random() * 1825)) * 86_400_000).toISOString().slice(0, 10);

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

const focusedResults = [{ pointCode: "BRK-001", status: "GOOD" as const }];

/**
 * The whole cross-module journey a booked service actually takes:
 *
 *   member books → the job appears on the field board with its vehicle →
 *   the mechanic's offline inspection syncs → the booking completes itself →
 *   the inspection is reachable as history for the next visit.
 *
 * Each step here was previously broken in a different module, and each was
 * individually unit/e2e tested afterwards — but the value of the chain is that
 * the *handoffs* hold. A board row that omits vehicleId, or a history row that
 * omits inspectionId, passes its own module's tests and still dead-ends the
 * technician; only walking the whole path catches that.
 */
describe("journey: booking → inspection → completion → history (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let redis: RedisService;
  let mechToken: string;
  let advisorToken: string;
  let adminToken: string;
  let vehicleId: string;
  let serviceTypeId: string;
  let bayId: string;
  let checklistVersionId: string;
  let templateId: string;
  const mechId = randomUUID();

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);
  const mech = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${mechToken}`);
  const advisor = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${advisorToken}`);
  const admin = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${adminToken}`);

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

    await seedChecklist(prisma as any);
    const baseline = await prisma.checklistVersion.findFirst({ where: { isActive: true, status: "PUBLISHED" }, select: { id: true } });
    if (!baseline) throw new Error("A published active baseline is required to create the focused test template");

    const member = await prisma.user.create({
      data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    });
    // isCertifiedTechnician matters: the sync handler rejects uncertified mechanics (BR-06).
    await prisma.user.create({ data: { id: mechId, firebaseUid: `${TAG}-mech`, role: "MECHANIC", isCertifiedTechnician: true } });
    const advisorUser = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    const adminUser = await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, role: "ADMIN" } });
    mechToken = await seal(mechId, "MECHANIC");
    advisorToken = await seal(advisorUser.id, "ADVISOR");
    adminToken = await seal(adminUser.id, "ADMIN");

    const template = await admin().post("/api/v1/admin/inspection-templates")
      .send({ name: `${TAG} Brake checks`, scope: "FOCUSED" }).expect(201);
    templateId = template.body.data.id;
    const draft = await admin().post(`/api/v1/admin/inspection-templates/${templateId}/versions`)
      .send({ sourceVersionId: baseline.id }).expect(201);
    checklistVersionId = draft.body.data.versions.find((item: any) => item.status === "DRAFT").id;
    await admin().patch(`/api/v1/admin/inspection-templates/${templateId}/versions/${checklistVersionId}`).send({
      categories: [{
        code: "BRAKES", label: "Brakes", labelFil: "Preno", weight: 100,
        points: [{
          code: "BRK-001", label: "Brake operation", labelFil: "Pag-andar ng preno",
          weightInCategory: 100, isSafetyCritical: true, inputType: "STATUS",
          recommendation: "Inspect brake operation", requiresPhotoOnAdverse: false,
        }],
      }],
    }).expect(200);
    await admin().post(`/api/v1/admin/inspection-templates/${templateId}/versions/${checklistVersionId}/publish`).expect(201);

    vehicleId = (
      await prisma.vehicle.create({
        data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 30_000 },
      })
    ).id;

    serviceTypeId = (
      await prisma.serviceType.create({
        data: {
          code: `${TAG}-INSP`, name: "Brake Inspection", standardDurationMin: 60,
          requiredSkills: ["OIL"], priceCentavos: 50000n, inspectionRequired: true,
          inspectionTemplateVersionId: checklistVersionId,
        },
      })
    ).id;
    bayId = (await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } })).id;
    await prisma.operatingHours.create({ data: { dateOverride: DATE, openTime: "09:00", closeTime: "17:00", walkInBufferPct: 0 } });
    await prisma.staffShift.create({ data: { userId: mechId, date: DATE, startTime: "09:00", endTime: "17:00", skills: ["OIL"] } });
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

      const inspections = await prisma.inspection.findMany({ where: { vehicleId }, select: { id: true } });
      const ids = inspections.map((i) => i.id);
      const scoreIds = (await prisma.healthScore.findMany({ where: { inspectionId: { in: ids } }, select: { id: true } })).map((s) => s.id);
      await prisma.recommendation.deleteMany({ where: { healthScoreId: { in: scoreIds } } });
      await prisma.categoryScore.deleteMany({ where: { healthScoreId: { in: scoreIds } } });
      await prisma.healthScore.deleteMany({ where: { id: { in: scoreIds } } });
      await prisma.inspectionResult.deleteMany({ where: { inspectionId: { in: ids } } });
      await prisma.inspectionObservation.deleteMany({ where: { inspectionId: { in: ids } } });
      await prisma.inspectionPhoto.deleteMany({ where: { inspectionId: { in: ids } } });
      await prisma.inspection.deleteMany({ where: { id: { in: ids } } });
      await prisma.syncOutboxReceipt.deleteMany({ where: { userId: mechId } });
      await prisma.appointment.deleteMany({ where: { vehicleId } });
      await prisma.announcement.deleteMany({ where: { vehicleId } });
      await prisma.odometerReading.deleteMany({ where: { vehicleId } });
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });
      await prisma.serviceBay.deleteMany({ where: { id: bayId } });
      await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
      if (checklistVersionId) {
        await prisma.checklistPoint.deleteMany({ where: { category: { checklistVersionId } } });
        await prisma.checklistCategory.deleteMany({ where: { checklistVersionId } });
        await prisma.checklistVersion.delete({ where: { id: checklistVersionId } }).catch(() => undefined);
      }
      if (templateId) await prisma.inspectionTemplate.delete({ where: { id: templateId } }).catch(() => undefined);
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      const userIds = (await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } }, select: { id: true } })).map((user) => user.id);
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  // Carried between the ordered steps below.
  let appointmentId: string;
  let boardVehicleId: string;
  let inspectionClientUuid: string;

  it("1. the member books a slot and the appointment starts out BOOKED", async () => {
    const slots = (
      await as(`${TAG}-mem`).get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`).expect(200)
    ).body.data;
    expect(slots.length).toBeGreaterThan(0);

    const holdId = (
      await as(`${TAG}-mem`).post("/api/v1/scheduling/holds").send({ bayId: slots[0].bayId, start: slots[0].start, serviceTypeId }).expect(201)
    ).body.data.holdId;

    const res = await as(`${TAG}-mem`)
      .post("/api/v1/appointments")
      .send({ holdId, vehicleId, serviceTypeId, requiresPickup: false })
      .expect(201);

    appointmentId = res.body.data.id;
    expect(res.body.data.status).toBe("BOOKED");
  });

  it("2. the booking reaches the field board carrying the vehicle to inspect", async () => {
    const board = (await mech().get(`/api/v1/scheduling/board?from=${DATE}&to=${DATE}`).expect(200)).body.data;
    const row = board.find((r: any) => r.id === appointmentId);

    expect(row).toBeDefined();
    expect(row.status).toBe("BOOKED");
    expect(row.vehiclePlateNo).toBe(`${TAG}-PL`);
    // The handoff that used to be missing: without vehicleId the field app can
    // only offer a plate search instead of opening the booked vehicle.
    expect(row.vehicleId).toBe(vehicleId);
    boardVehicleId = row.vehicleId;
  });

  it("3. the mechanic's offline inspection syncs as one batch, linked to the booking", async () => {
    inspectionClientUuid = randomUUID();
    const res = await mech()
      .post("/api/v1/sync/batch")
      .send({
        items: [
          {
            clientUuid: inspectionClientUuid,
            entityType: "inspection",
            op: "create",
            // vehicleId and appointmentId both come from the board row — exactly
            // what the field app now threads through to the outbox payload.
            payload: { vehicleId: boardVehicleId, appointmentId, checklistVersionId, results: focusedResults, odometerKm: 31_000 },
          },
          {
            clientUuid: randomUUID(),
            entityType: "inspection",
            op: "submit",
            payload: { inspectionClientUuid },
          },
        ],
      })
      .expect(201);

    expect(res.body.data.results.map((r: any) => r.status)).toEqual(["APPLIED", "APPLIED"]);
    const inspection = await prisma.inspection.findUniqueOrThrow({ where: { clientUuid: inspectionClientUuid } });
    expect(inspection.appointmentId).toBe(appointmentId);
    expect(inspection.submittedAt).not.toBeNull();
  });

  it("4. submitting completes the booking, and the board now shows it done", async () => {
    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.status).toBe("COMPLETED");

    // What the technician sees on returning to the task list: the card is no
    // longer outstanding. Previously it stayed BOOKED forever.
    const board = (await mech().get(`/api/v1/scheduling/board?from=${DATE}&to=${DATE}`).expect(200)).body.data;
    expect(board.find((r: any) => r.id === appointmentId).status).toBe("COMPLETED");
  });

  it("5. the finished focused inspection is reachable without creating a full score", async () => {
    const history = (await mech().get(`/api/v1/vehicles/${vehicleId}/inspections`).expect(200)).body.data;
    expect(history.length).toBeGreaterThan(0);

    const point = history[0];
    expect(point.scope).toBe("FOCUSED");
    expect(point.score).toBeNull();
    // Focused history uses the inspection identity directly so it opens without a score row.
    expect(point.id).toBeDefined();

    const detail = (await mech().get(`/api/v1/vehicles/${vehicleId}/inspections/${point.id}`).expect(200)).body.data;
    expect(detail.id).toBe(point.id);
    expect(detail.scope).toBe("FOCUSED");
    expect(detail.odometerKm).toBe(31_000);
    expect(detail.results.map((result: any) => result.pointCode)).toEqual(["BRK-001"]);
  });

  it("6. a re-sent batch is de-duplicated and does not disturb the completed booking", async () => {
    // Field devices retry on reconnect; the same clientUuid must not double-apply.
    const res = await mech()
      .post("/api/v1/sync/batch")
      .send({
        items: [{
          clientUuid: inspectionClientUuid,
          entityType: "inspection",
          op: "create",
          payload: { vehicleId, appointmentId, checklistVersionId, results: focusedResults, odometerKm: 31_000 },
        }],
      })
      .expect(201);

    expect(res.body.data.results[0].status).toBe("DUPLICATE");
    expect(await prisma.inspection.count({ where: { vehicleId } })).toBe(1);
    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.status).toBe("COMPLETED");
  });

  it("7. an advisor cancelling after the fact is not overwritten by a late sync", async () => {
    // A device that was offline during the cancellation still holds a queued
    // submit. Replaying it must not resurrect the booking.
    const late = await prisma.appointment.create({
      data: {
        vehicleId, serviceTypeId, createdBy: mechId, status: "CANCELLED",
        scheduledStart: new Date(`${DATE}T06:00:00Z`), scheduledEnd: new Date(`${DATE}T07:00:00Z`),
        inspectionRequiredSnapshot: true, inspectionTemplateVersionId: checklistVersionId,
        serviceNameSnapshot: "Brake Inspection", servicePriceCentavosSnapshot: 50000n,
        currencySnapshot: "PHP", coveredBySubscription: false, billingSnapshotKnown: true,
      },
    });
    const createUuid = randomUUID();
    await mech()
      .post("/api/v1/sync/batch")
      .send({
        items: [
          { clientUuid: createUuid, entityType: "inspection", op: "create", payload: { vehicleId, appointmentId: late.id, checklistVersionId, results: focusedResults, odometerKm: 32_000 } },
          { clientUuid: randomUUID(), entityType: "inspection", op: "submit", payload: { inspectionClientUuid: createUuid } },
        ],
      })
      .expect(201);

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: late.id } })).status).toBe("CANCELLED");
    // The inspection itself is still real work and must be recorded.
    expect((await prisma.inspection.findUniqueOrThrow({ where: { clientUuid: createUuid } })).submittedAt).not.toBeNull();
  });
});
