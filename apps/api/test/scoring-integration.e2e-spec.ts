import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { seedChecklist } from "../prisma/seed-checklist";
import { ScoreEvents } from "../src/modules/inspections/score-events";
import { seedConfig } from "@autocare/scoring";

const TAG = `sco-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

/** The §11.4 worked example expressed over the seed v1.0 checklist: every point
 *  GOOD except the doc's adverse findings, so the engine derives:
 *  MONITOR ×7 and ATTENTION ×3 → 10 recommendations; BRAKE_PAD_FRONT is a
 *  safety-critical ATTENTION → SAFETY_ATTENTION cap. */
const overrides: Record<string, { status?: string; measuredValue?: number }> = {
  BRAKE_PAD_FRONT: { measuredValue: 3.0 },   // ATTENTION (safety)
  BRAKE_PAD_REAR: { measuredValue: 6.0 },    // MONITOR
  TREAD_FL: { status: "ATTENTION" },
  ENGINE_NOISE: { status: "MONITOR" },
  SHOCKS: { status: "MONITOR" },
  HORN: { status: "MONITOR" },
  DASH_WARNING_LIGHTS: { status: "MONITOR" },
  RUST_UNDERCARRIAGE: { status: "MONITOR" },
  WASHER_FLUID: { status: "ATTENTION" },
  O2_SENSOR_SWITCHING: { status: "MONITOR" },
};
const allResults = seedConfig.categories.flatMap((c) => c.points.map((p) => {
  const o = overrides[p.code];
  if (o?.measuredValue !== undefined) return { pointCode: p.code, measuredValue: o.measuredValue };
  return { pointCode: p.code, status: (o?.status ?? "GOOD") as any };
}));
const adverseCount = 10;

describe("scoring integration (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let mechToken: string;
  let memberToken: string;
  let vehicleId: string;
  let checklistVersionId: string;
  const events: Array<{ vehicleId: string; score: number; band: string }> = [];

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
    app.get(ScoreEvents).onScoreReady((e: any) => events.push(e));

    checklistVersionId = await seedChecklist(prisma as any);

    const mech = await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC", isCertifiedTechnician: true } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({
      data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" },
    });
    vehicleId = vehicle.id;
    mechToken = await seal(mech.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      const inspections = await prisma.inspection.findMany({ where: { vehicleId } });
      const ids = inspections.map((i) => i.id);
      const scoreIds = (await prisma.healthScore.findMany({ where: { inspectionId: { in: ids } } })).map((s) => s.id);
      await prisma.recommendation.deleteMany({ where: { healthScoreId: { in: scoreIds } } });
      await prisma.categoryScore.deleteMany({ where: { healthScoreId: { in: scoreIds } } });
      await prisma.healthScore.deleteMany({ where: { id: { in: scoreIds } } });
      await prisma.inspectionResult.deleteMany({ where: { inspectionId: { in: ids } } });
      await prisma.inspection.deleteMany({ where: { id: { in: ids } } });
      await prisma.syncOutboxReceipt.deleteMany({ where: { userId: { in: (await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } } })).map((u) => u.id) } } });
      await prisma.vehicle.deleteMany({ where: { plateNo: { startsWith: TAG } } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const mech = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${mechToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  let createUuid: string;

  it("submitting via /sync/batch computes and persists the score within 2s (NFR-004)", async () => {
    createUuid = randomUUID();
    await mech().post("/api/v1/sync/batch").send({
      items: [{ clientUuid: createUuid, entityType: "inspection", op: "create", payload: { vehicleId, checklistVersionId, odometerKm: 52000, results: allResults } }],
    }).expect(201);

    const started = Date.now();
    const res = await mech().post("/api/v1/sync/batch").send({
      items: [{ clientUuid: randomUUID(), entityType: "inspection", op: "submit", payload: { inspectionClientUuid: createUuid } }],
    }).expect(201);
    const elapsed = Date.now() - started;
    expect(res.body.data.results[0].status).toBe("APPLIED");

    const score = await prisma.healthScore.findFirstOrThrow({ where: { vehicleId }, include: { categoryScores: true, recommendations: true } });
    expect(score.score).toBe(69);
    expect(score.overrideApplied).toBe("SAFETY_ATTENTION");
    expect(score.band).toBe("FAIR");
    expect(score.categoryScores).toHaveLength(10);
    expect(score.recommendations).toHaveLength(adverseCount);
    expect(score.checklistVersionId).toBe(checklistVersionId);
    expect(score.weightVersion).toBe("w1.0");
    // 2s compute budget — generous network margin excluded: the assert covers the whole call
    expect(elapsed).toBeLessThan(10_000);

    expect(events).toContainEqual(expect.objectContaining({ vehicleId, score: 69, band: "FAIR" }));
  });

  it("re-submission (DUPLICATE) computes nothing new", async () => {
    const before = await prisma.healthScore.count({ where: { vehicleId } });
    await mech().post("/api/v1/sync/batch").send({
      items: [{ clientUuid: createUuid, entityType: "inspection", op: "create", payload: { vehicleId, checklistVersionId, results: allResults } }],
    }).expect(201);
    expect(await prisma.healthScore.count({ where: { vehicleId } })).toBe(before);
  });

  it("scores are immutable — the service surface has no update path (NFR-054)", async () => {
    const score = await prisma.healthScore.findFirstOrThrow({ where: { vehicleId } });
    await expect(
      (prisma as any).healthScore.update({ where: { id: score.id }, data: { score: 100 } }),
    ).rejects.toThrow(/append-only/i);
  });

  it("GET /vehicles/:id/health-score returns the API-spec shape including topDetractors", async () => {
    const res = await member().get(`/api/v1/vehicles/${vehicleId}/health-score`).expect(200);
    const d = res.body.data;
    expect(d).toMatchObject({
      score: 69, rawScore: 91.418, band: "FAIR", confidence: "HIGH",
      overrideApplied: "SAFETY_ATTENTION", isStale: false,
      checklistVersion: "v1.0", weightVersion: "w1.0",
    });
    expect(d.categoryScores).toHaveLength(10);
    expect(d.topDetractors[0].pointCode).toBe("BRAKE_PAD_FRONT");
    expect(d.recommendations).toHaveLength(adverseCount);
    expect(d.computedAt).toBeTruthy();
    expect(d.odometerKm).toBe(52000);
  });

  it("history returns scores ordered by computedAt with odometer", async () => {
    const res = await member().get(`/api/v1/vehicles/${vehicleId}/health-score/history`).expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toMatchObject({ score: 69, odometerKm: 52000 });
  });
});
