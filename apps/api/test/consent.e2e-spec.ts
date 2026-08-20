import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const POLICY = "2026-08-privacy-v1";

describe("consent (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async () => ({ uid: "consent-uid", phone: "+639171112222" }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: "consent-uid" } } });
    await prisma.user.deleteMany({ where: { firebaseUid: "consent-uid" } });
    await app.close();
  });

  const auth = (r: request.Test) => r.set("Authorization", "Bearer t");

  it("session reports consentRequired=true for a fresh member", async () => {
    const res = await auth(request(app.getHttpServer()).post("/api/v1/auth/session")).expect(201);
    expect(res.body.data.consentRequired).toBe(true);
  });
  it("blocks a non-auth endpoint with CONSENT_REQUIRED before consent", async () => {
    const res = await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(403);
    expect(res.body.error.code).toBe("CONSENT_REQUIRED");
  });
  it("rejects a consent body missing policyVersion with 400", async () => {
    await auth(request(app.getHttpServer()).post("/api/v1/auth/consent").send({})).expect(400);
  });
  it("unblocks after consenting to the current version", async () => {
    await auth(request(app.getHttpServer()).post("/api/v1/auth/consent").send({ policyVersion: POLICY })).expect(201);
    await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(200);
    const res = await auth(request(app.getHttpServer()).post("/api/v1/auth/session"));
    expect(res.body.data.consentRequired).toBe(false);
  });
  it("re-blocks after a policy version bump", async () => {
    process.env.POLICY_VERSION = "2026-12-privacy-v2";
    const res = await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(403);
    expect(res.body.error.code).toBe("CONSENT_REQUIRED");
    process.env.POLICY_VERSION = POLICY;
  });
});
