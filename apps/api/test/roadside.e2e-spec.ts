import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const TAG = `rs-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

// The DPA consent guard blocks every member route, so the fixture seeds a
// consented user and reaches the API with a sealed session token — the same
// shape every other e2e in this suite uses.
async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .encrypt(key);
}

describe("roadside (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let memberToken: string;

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

    const member = await prisma.user.create({
      data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    });
    memberToken = await seal(member.id, "MEMBER");
  });

  afterAll(async () => {
    const seeded = await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } }, select: { id: true } });
    const ids = seeded.map((u) => u.id);
    await prisma.consentRecord.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it("reports a fresh member as not eligible, with a reason rather than a bare no", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/eligibility")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body.data.eligible).toBe(false);
    expect(typeof res.body.data.reason).toBe("string");
    expect(res.body.data.reason.length).toBeGreaterThan(10);
  });

  it("refuses an ineligible request with ROADSIDE_NOT_ELIGIBLE", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/roadside/requests")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ vehicleId: "3f1a0c9e-0000-4000-8000-000000000001", incidentType: "FLAT_TYRE", lat: 6.9214, lng: 122.079 })
      .expect(403);
    expect(res.body.error.code).toBe("ROADSIDE_NOT_ELIGIBLE");
  });

  it("rejects a malformed body before it reaches the service", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/roadside/requests")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ vehicleId: "not-a-uuid", incidentType: "NOPE", lat: 999, lng: 0 })
      .expect(400);
  });

  it("keeps the dispatch board away from members", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/board")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("keeps the responder list away from members too", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/responders")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("returns null when the member has no live incident", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/requests/active")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body.data).toBeNull();
  });
});
