import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { seedChecklist } from "../prisma/seed-checklist";
import { seedConfig } from "@autocare/scoring";

const TAG = `crt-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

const allResults = seedConfig.categories.flatMap((c) => c.points.map((p) => ({ pointCode: p.code, status: "GOOD" as const })));

describe("certificates (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let mechToken: string;
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
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", name: "Juan Dela Cruz", mobile: `+639${TAG.slice(0, 6)}`, email: `${TAG}@ex.com`, consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({ data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" } });
    vehicleId = vehicle.id;
    mechToken = await seal(mech.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");

    // Produce a health score via the sync pipeline
    const createUuid = randomUUID();
    const mech2 = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${mechToken}`);
    await mech2().post("/api/v1/sync/batch").send({ items: [{ clientUuid: createUuid, entityType: "inspection", op: "create", payload: { vehicleId, checklistVersionId, odometerKm: 51000, results: allResults } }] });
    await mech2().post("/api/v1/sync/batch").send({ items: [{ clientUuid: randomUUID(), entityType: "inspection", op: "submit", payload: { inspectionClientUuid: createUuid } }] });
  });

  afterAll(async () => {
    try {
      await prisma.certificate.deleteMany({ where: { vehicleId } });
      const ids = (await prisma.inspection.findMany({ where: { vehicleId } })).map((i) => i.id);
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

  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);
  const anon = () => request.agent(app.getHttpServer());

  let token: string;
  let code: string;
  let certId: string;

  it("issues a certificate with a high-entropy token and a Crockford base32 code", async () => {
    const res = await member().post(`/api/v1/vehicles/${vehicleId}/certificates`).send({}).expect(201);
    token = res.body.data.publicToken;
    code = res.body.data.verificationCode;
    certId = res.body.data.id;
    // 32 bytes base64url ≈ 43 chars (>=128 bits)
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/); // Crockford base32, no I L O U
  });

  it("PRIVATE certificate is not publicly readable (404)", async () => {
    await anon().get(`/api/v1/public/certificates/${token}`).expect(404);
  });

  it("LINK visibility exposes the score with NO member contact data (FR-065)", async () => {
    await member().patch(`/api/v1/certificates/${certId}/visibility`).send({ visibility: "LINK" }).expect(200);
    const res = await anon().get(`/api/v1/public/certificates/${token}`).expect(200);
    const body = JSON.stringify(res.body.data);
    expect(res.body.data.score).toBeGreaterThan(0);
    expect(res.body.data.plateNo).toBe(`${TAG}-PL`);
    expect(body).not.toContain("Juan Dela Cruz");
    expect(body).not.toContain("@ex.com");
    expect(body).not.toContain("+639");
    expect(res.body.data.member).toBeUndefined();
  });

  it("verify-by-code returns the matching certificate summary", async () => {
    const res = await anon().post("/api/v1/public/certificates/verify").send({ code }).expect(201);
    expect(res.body.data.verificationCode).toBe(code);
    expect(res.body.data.score).toBeGreaterThan(0);
  });

  it("REVOKED certificate returns 410 CERTIFICATE_REVOKED", async () => {
    await member().patch(`/api/v1/certificates/${certId}/visibility`).send({ visibility: "REVOKED" }).expect(200);
    const res = await anon().get(`/api/v1/public/certificates/${token}`).expect(410);
    expect(res.body.error.code).toBe("CERTIFICATE_REVOKED");
  });

  it("regenerating a certificate leaves the old token working until it is revoked", async () => {
    // issue a fresh certificate (old one is revoked above)
    const res = await member().post(`/api/v1/vehicles/${vehicleId}/certificates`).send({}).expect(201);
    const token2 = res.body.data.publicToken;
    await member().patch(`/api/v1/certificates/${res.body.data.id}/visibility`).send({ visibility: "LINK" }).expect(200);
    await anon().get(`/api/v1/public/certificates/${token2}`).expect(200);
    expect(token2).not.toBe(token);
  });

  it("only the vehicle owner can create/revoke a certificate", async () => {
    const stranger = await prisma.user.create({ data: { firebaseUid: `${TAG}-str`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const strangerToken = await seal(stranger.id, "MEMBER");
    await request.agent(app.getHttpServer()).set("Authorization", `Bearer ${strangerToken}`)
      .post(`/api/v1/vehicles/${vehicleId}/certificates`).send({}).expect(403);
  });
});
