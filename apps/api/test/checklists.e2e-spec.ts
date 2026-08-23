import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { seedChecklist } from "../prisma/seed-checklist";

const TAG = `ckl-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

describe("checklist versioning admin (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let adminToken: string;
  let mechToken: string;
  let memberToken: string;
  let originalActiveId: string;
  const createdVersionIds: string[] = [];

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

    await seedChecklist(prisma as any);
    originalActiveId = (await prisma.checklistVersion.findFirstOrThrow({ where: { isActive: true } })).id;

    const admin = await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, role: "ADMIN" } });
    const mech = await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC" } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    adminToken = await seal(admin.id, "ADMIN");
    mechToken = await seal(mech.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      // Restore the original active version and remove every version this run created.
      await prisma.checklistVersion.update({ where: { id: originalActiveId }, data: { isActive: true, status: "PUBLISHED" } });
      for (const id of createdVersionIds) {
        await prisma.checklistPoint.deleteMany({ where: { category: { checklistVersionId: id } } });
        await prisma.checklistCategory.deleteMany({ where: { checklistVersionId: id } });
        await prisma.checklistVersion.delete({ where: { id } }).catch(() => undefined);
      }
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: (await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } } })).map(u => u.id) } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const admin = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${adminToken}`);
  const mech = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${mechToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  it("staff read the active checklist with ETag; If-None-Match → 304; members are forbidden", async () => {
    const res = await mech().get("/api/v1/checklists/active").expect(200);
    expect(res.body.data.categories).toHaveLength(10);
    const etag = res.headers.etag;
    expect(etag).toBeTruthy();
    await mech().get("/api/v1/checklists/active").set("If-None-Match", etag).expect(304);
    await member().get("/api/v1/checklists/active").expect(403);
  });

  let draftId: string;

  it("admin clones the active version into an editable draft; mechanics cannot", async () => {
    await mech().post("/api/v1/admin/checklists").expect(403);
    const res = await admin().post("/api/v1/admin/checklists").expect(201);
    draftId = res.body.data.id;
    createdVersionIds.push(draftId);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.isActive).toBe(false);
    const listed = await admin().get("/api/v1/admin/checklists").expect(200);
    expect(listed.body.data.some((v: any) => v.id === draftId)).toBe(true);
  });

  it("PATCH edits a draft; weight sum ≠ 100 is rejected on publish, not on save", async () => {
    const active = (await admin().get(`/api/v1/admin/checklists/${draftId}`).expect(200)).body.data;
    const categories = active.categories.map((c: any) => ({
      code: c.code, label: c.label, labelFil: c.labelFil, weight: c.weight,
      points: c.points.map((p: any) => ({
        code: p.code, label: p.label, labelFil: p.labelFil, weightInCategory: p.weightInCategory,
        isSafetyCritical: p.isSafetyCritical, inputType: p.inputType, unit: p.unit ?? undefined,
        thresholds: p.thresholds ?? undefined, recommendation: p.recommendation,
        templates: p.templates ?? undefined, requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
        notApplicableWhen: p.notApplicableWhen ?? undefined,
      })),
    }));
    categories[0].weight = 50; // breaks the sum (total 132)
    await admin().patch(`/api/v1/admin/checklists/${draftId}`).send({ categories }).expect(200);
    const res = await admin().post(`/api/v1/admin/checklists/${draftId}/publish`).expect(409);
    expect(res.body.error.code).toBe("CHECKLIST_INVALID");
    // restore a valid sum for the publish test
    categories[0].weight = 18;
    await admin().patch(`/api/v1/admin/checklists/${draftId}`).send({ categories }).expect(200);
  });

  it("preview-score runs the engine against the draft without persisting anything", async () => {
    const before = await prisma.healthScore.count();
    const res = await admin()
      .post(`/api/v1/admin/checklists/${draftId}/preview-score`)
      .send({ results: [{ pointCode: "ENGINE_IDLE", status: "GOOD" }], daysSinceInspection: 0 })
      .expect(201);
    expect(res.body.data.score).toBe(100);
    expect(await prisma.healthScore.count()).toBe(before);
  });

  it("publish: deactivates previous active, bumps weightVersion on weight change, then the version is immutable", async () => {
    const res = await admin().post(`/api/v1/admin/checklists/${draftId}/publish`).expect(201);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.status).toBe("PUBLISHED");
    // draft weights were round-tripped unchanged → weightVersion stays w1.0
    expect(res.body.data.weightVersion).toBe("w1.0");

    const prev = await prisma.checklistVersion.findUniqueOrThrow({ where: { id: originalActiveId } });
    expect(prev.isActive).toBe(false);

    const patch = await admin().patch(`/api/v1/admin/checklists/${draftId}`).send({ categories: [] });
    expect([400, 409]).toContain(patch.status); // 409 immutable (or 400 if body invalid first)
    const publishedPatch = await admin().patch(`/api/v1/admin/checklists/${draftId}`).send({
      categories: [{ code: "X", label: "X", weight: 100, points: [{ code: "P", label: "P", weightInCategory: 100, isSafetyCritical: false, inputType: "STATUS", recommendation: "r" }] }],
    }).expect(409);
    expect(publishedPatch.body.error.code).toBe("CHECKLIST_IMMUTABLE");
  });

  it("a weight change on a new draft bumps weightVersion on publish; scores under the old version keep their reference", async () => {
    // Clone the (new) active, change a weight, publish → w1.1
    const res = await admin().post("/api/v1/admin/checklists").expect(201);
    const draft2 = res.body.data.id;
    createdVersionIds.push(draft2);
    const full = (await admin().get(`/api/v1/admin/checklists/${draft2}`).expect(200)).body.data;
    const categories = full.categories.map((c: any) => ({
      code: c.code, label: c.label, labelFil: c.labelFil, weight: c.weight,
      points: c.points.map((p: any) => ({
        code: p.code, label: p.label, labelFil: p.labelFil, weightInCategory: p.weightInCategory,
        isSafetyCritical: p.isSafetyCritical, inputType: p.inputType, unit: p.unit ?? undefined,
        thresholds: p.thresholds ?? undefined, recommendation: p.recommendation,
        templates: p.templates ?? undefined, requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
        notApplicableWhen: p.notApplicableWhen ?? undefined,
      })),
    }));
    // swap two category weights — still sums to 100 but differs from active
    const w0 = categories[0].weight;
    categories[0].weight = categories[1].weight;
    categories[1].weight = w0;
    await admin().patch(`/api/v1/admin/checklists/${draft2}`).send({ categories }).expect(200);
    const pub = await admin().post(`/api/v1/admin/checklists/${draft2}/publish`).expect(201);
    expect(pub.body.data.weightVersion).toBe("w1.1");

    // v1.0's stored data is untouched by the new publish
    const v10 = await prisma.checklistVersion.findUniqueOrThrow({ where: { id: originalActiveId } });
    expect(v10.weightVersion).toBe("w1.0");
    expect(v10.status).toBe("PUBLISHED");
  });

  it("admin mutations are audit-logged", async () => {
    const rows = await prisma.auditLog.findMany({ where: { entityType: "ChecklistVersion" }, orderBy: { createdAt: "desc" }, take: 10 });
    const actions = rows.map(r => r.action);
    expect(actions).toEqual(expect.arrayContaining(["CHECKLIST_DRAFT_CREATED", "CHECKLIST_DRAFT_EDITED", "CHECKLIST_PUBLISHED"]));
  });
});
