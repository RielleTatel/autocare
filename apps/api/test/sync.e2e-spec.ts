import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { seedChecklist } from "../prisma/seed-checklist";
import { seedConfig } from "@autocare/scoring";

const TAG = `syn-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

const allPointCodes = seedConfig.categories.flatMap((c) => c.points.map((p) => p.code));
const fullResults = allPointCodes.map((code) => ({ pointCode: code, status: "GOOD" as const }));

describe("/sync/batch (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let mechToken: string;
  let uncertToken: string;
  let memberToken: string;
  let vehicleId: string;
  let checklistVersionId: string;

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

    checklistVersionId = await seedChecklist(prisma as any);

    const mech = await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC", isCertifiedTechnician: true } });
    const uncert = await prisma.user.create({ data: { firebaseUid: `${TAG}-unc`, role: "MECHANIC", isCertifiedTechnician: false } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({
      data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" },
    });
    vehicleId = vehicle.id;
    mechToken = await seal(mech.id, "MECHANIC");
    uncertToken = await seal(uncert.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      const inspections = await prisma.inspection.findMany({ where: { vehicle: { plateNo: { startsWith: TAG } } } });
      const ids = inspections.map((i) => i.id);
      const scores = await prisma.healthScore.findMany({ where: { inspectionId: { in: ids } } });
      const scoreIds = scores.map((s) => s.id);
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
  const uncert = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uncertToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  const createItem = (clientUuid: string, overrides: Record<string, unknown> = {}) => ({
    clientUuid,
    entityType: "inspection" as const,
    op: "create" as const,
    payload: { vehicleId, checklistVersionId, results: fullResults, odometerKm: 45000, ...overrides },
  });

  it("applies a batch of 2 inspections and writes receipts", async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const res = await mech().post("/api/v1/sync/batch").send({ items: [createItem(a), createItem(b)] }).expect(201);
    expect(res.body.data.results).toEqual([
      { clientUuid: a, status: "APPLIED" },
      { clientUuid: b, status: "APPLIED" },
    ]);
    expect(await prisma.syncOutboxReceipt.count({ where: { clientUuid: { in: [a, b] } } })).toBe(2);
    expect(await prisma.inspection.count({ where: { clientUuid: { in: [a, b] } } })).toBe(2);
  });

  it("replaying an identical batch returns DUPLICATE for both with row counts unchanged", async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const items = [createItem(a), createItem(b)];
    await mech().post("/api/v1/sync/batch").send({ items }).expect(201);
    const before = await prisma.inspection.count({ where: { vehicleId } });
    const res = await mech().post("/api/v1/sync/batch").send({ items }).expect(201);
    expect(res.body.data.results.map((r: any) => r.status)).toEqual(["DUPLICATE", "DUPLICATE"]);
    expect(await prisma.inspection.count({ where: { vehicleId } })).toBe(before);
  });

  it("partial success: one invalid item is REJECTED with INSPECTION_INCOMPLETE, the other APPLIED", async () => {
    const [good, bad] = [randomUUID(), randomUUID()];
    const badItem = {
      clientUuid: bad,
      entityType: "inspection" as const,
      op: "submit" as const,
      payload: { inspectionClientUuid: randomUUID() }, // no such inspection → incomplete/unknown
    };
    // an incomplete submit: create with partial results, then submit
    const partialCreate = createItem(bad, { results: fullResults.slice(0, 5) });
    const submitOfPartial = {
      clientUuid: randomUUID(),
      entityType: "inspection" as const,
      op: "submit" as const,
      payload: { inspectionClientUuid: bad },
    };
    const res = await mech().post("/api/v1/sync/batch")
      .send({ items: [createItem(good), partialCreate, submitOfPartial] })
      .expect(201);
    const byUuid = Object.fromEntries(res.body.data.results.map((r: any) => [r.clientUuid, r]));
    expect(byUuid[good].status).toBe("APPLIED");
    expect(byUuid[partialCreate.clientUuid].status).toBe("APPLIED"); // create itself is fine
    expect(byUuid[submitOfPartial.clientUuid].status).toBe("REJECTED");
    expect(byUuid[submitOfPartial.clientUuid].error.code).toBe("INSPECTION_INCOMPLETE");
    void badItem;
  });

  it("a non-certified mechanic is rejected with NOT_CERTIFIED_TECHNICIAN (BR-06)", async () => {
    const id = randomUUID();
    const res = await uncert().post("/api/v1/sync/batch").send({ items: [createItem(id)] }).expect(201);
    expect(res.body.data.results[0]).toMatchObject({ status: "REJECTED", error: { code: "NOT_CERTIFIED_TECHNICIAN" } });
    expect(await prisma.inspection.count({ where: { clientUuid: id } })).toBe(0);
  });

  it("items are processed in array order: submit-after-create within one batch works", async () => {
    const createUuid = randomUUID();
    const submitUuid = randomUUID();
    const res = await mech().post("/api/v1/sync/batch").send({
      items: [
        createItem(createUuid),
        { clientUuid: submitUuid, entityType: "inspection", op: "submit", payload: { inspectionClientUuid: createUuid } },
      ],
    }).expect(201);
    expect(res.body.data.results.map((r: any) => r.status)).toEqual(["APPLIED", "APPLIED"]);
    const inspection = await prisma.inspection.findUniqueOrThrow({ where: { clientUuid: createUuid } });
    expect(inspection.submittedAt).not.toBeNull();
  });

  it("members get 403; GET /sync/status returns the caller's receipt stats", async () => {
    await member().post("/api/v1/sync/batch").send({ items: [createItem(randomUUID())] }).expect(403);
    const res = await mech().get("/api/v1/sync/status").expect(200);
    expect(res.body.data.receiptCount).toBeGreaterThan(0);
    expect(res.body.data.lastReceiptAt).toBeTruthy();
  });
});
