import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("plans (e2e)", () => {
  let app: any, prisma: PrismaService;
  const planCode = "E2E-BASIC";

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: { firebaseUid: "plan-admin", role: "ADMIN" } });
    await prisma.user.create({ data: { firebaseUid: "plan-member", role: "MEMBER",
      consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
  });

  afterAll(async () => {
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: planCode } } });
    await prisma.plan.deleteMany({ where: { code: planCode } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: ["plan-admin", "plan-member"] } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: ["plan-admin", "plan-member"] } } });
    await app.close();
  });

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);
  const body = {
    code: planCode, name: "E2E Basic", priceCentavos: 99900, billingInterval: "MONTHLY",
    lockInMonths: 6, entitlements: [{ entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 15000 }],
  };

  it("GET /plans is public and excludes archived/inactive plans with no auth header", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/plans").expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("non-admin cannot create or patch a plan — 403 FORBIDDEN_ROLE", async () => {
    const res = await as("plan-member").post("/api/v1/admin/plans").send(body).expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    await as("plan-member").patch("/api/v1/admin/plans/00000000-0000-0000-0000-000000000000").send({ name: "x" }).expect(403);
  });

  let planId: string;
  it("admin create → version 1, entitlements persisted, money round-trips as integer, audit row written", async () => {
    const res = await as("plan-admin").post("/api/v1/admin/plans").send(body).expect(201);
    planId = res.body.data.id;
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.priceCentavos).toBe(99900);
    expect(Number.isInteger(res.body.data.priceCentavos)).toBe(true);
    expect(res.body.data.entitlements).toHaveLength(1);
    expect(res.body.data.entitlements[0].overagePriceCentavos).toBe(15000);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Plan", entityId: planId, action: "PLAN_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("GET /plans includes the new active plan with entitlements", async () => {
    const res = await as("plan-member").get("/api/v1/plans").expect(200);
    const found = res.body.data.find((p: any) => p.id === planId);
    expect(found).toBeDefined();
    expect(found.entitlements).toHaveLength(1);
  });

  it("admin PATCH versions the plan: old archived, new row version=2, same code, response is new version", async () => {
    const res = await as("plan-admin").patch(`/api/v1/admin/plans/${planId}`).send({ priceCentavos: 129900 }).expect(200);
    expect(res.body.data.id).not.toBe(planId);
    expect(res.body.data.code).toBe(planCode);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.priceCentavos).toBe(129900);
    // unchanged fields carried over from v1
    expect(res.body.data.entitlements).toHaveLength(1);
    expect(res.body.data.entitlements[0].overagePriceCentavos).toBe(15000);

    const old = await prisma.plan.findUnique({ where: { id: planId } });
    expect(old?.isActive).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Plan", entityId: res.body.data.id, action: "PLAN_VERSIONED" } });
    expect(audit).not.toBeNull();

    planId = res.body.data.id;
  });

  it("GET /plans no longer returns the archived v1 row, only the active v2", async () => {
    const res = await as("plan-member").get("/api/v1/plans").expect(200);
    const versions = res.body.data.filter((p: any) => p.code === planCode);
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(2);
  });

  it("GET /admin/plans (admin) lists all versions including archived", async () => {
    const res = await as("plan-admin").get("/api/v1/admin/plans").expect(200);
    const versions = res.body.data.filter((p: any) => p.code === planCode);
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });
});
