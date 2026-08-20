import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("users (e2e)", () => {
  let app: any, prisma: PrismaService, memberId: string;
  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => ({ uid: t }) }) // token IS the uid in tests
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: { firebaseUid: "admin-uid", role: "ADMIN", name: "Admin" } });
    const m = await prisma.user.create({
      data: { firebaseUid: "member-uid", role: "MEMBER",
              consents: { create: { policyVersion: "2026-08-privacy-v1" } } },
    });
    memberId = m.id;
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: memberId } });
    await prisma.dataRequest.deleteMany({ where: { userId: memberId } });
    await prisma.consentRecord.deleteMany({ where: { userId: memberId } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: ["admin-uid", "member-uid"] } } });
    await app.close();
  });
  const as = (uid: string) => ({ get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`),
    patch: (p: string) => request(app.getHttpServer()).patch(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`),
    post: (p: string) => request(app.getHttpServer()).post(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`) });

  it("member updates profile (FR-011)", async () => {
    const res = await as("member-uid").patch("/users/me").send({ name: "Juan", address: "Tetuan, Zamboanga City" }).expect(200);
    expect(res.body.data.address).toBe("Tetuan, Zamboanga City");
  });
  it("member cannot suspend anyone; admin can, with audit row (FR-014)", async () => {
    await as("member-uid").patch(`/users/${memberId}/status`).send({ status: "SUSPENDED", reason: "self-harm?" }).expect(403);
    const res = await as("admin-uid").patch(`/users/${memberId}/status`).send({ status: "SUSPENDED", reason: "test suspension" }).expect(200);
    expect(res.body.data.status).toBe("SUSPENDED");
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "User", entityId: memberId } });
    expect(audit?.action).toContain("test suspension");
  });
  it("suspended member's token is rejected everywhere", async () => {
    const res = await as("member-uid").get("/users/me").expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    await as("admin-uid").patch(`/users/${memberId}/status`).send({ status: "ACTIVE", reason: "test done" }).expect(200);
  });
  it("data-export creates a PENDING DataRequest and enqueues (FR-013)", async () => {
    const res = await as("member-uid").post("/users/me/data-export").expect(201);
    expect(res.body.data.status).toBe("PENDING");
    const row = await prisma.dataRequest.findUnique({ where: { id: res.body.data.requestId } });
    expect(row?.type).toBe("EXPORT");
  });
});
