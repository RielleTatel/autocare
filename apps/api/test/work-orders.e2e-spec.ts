import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { seedChecklist } from "../prisma/seed-checklist";
import { seedParts } from "../prisma/seed-parts";
import { seedConfig } from "@autocare/scoring";

const TAG = `wo-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

// An inspection whose only adverse finding is the front brake pads (safety ATTENTION),
// so exactly one recommendation is created for the resurfacing test.
function inspectionResults(padValue: number) {
  return seedConfig.categories.flatMap((c) => c.points.map((p) => {
    if (p.code === "BRAKE_PAD_FRONT") return { pointCode: p.code, measuredValue: padValue };
    return { pointCode: p.code, status: "GOOD" as const };
  }));
}

describe("work orders (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let advisorToken: string;
  let mechToken: string;
  let memberToken: string;
  let strangerToken: string;
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
    await seedParts(prisma as any);

    const advisor = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    const mech = await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC", isCertifiedTechnician: true } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const stranger = await prisma.user.create({ data: { firebaseUid: `${TAG}-str`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({ data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" } });
    vehicleId = vehicle.id;
    advisorToken = await seal(advisor.id, "ADVISOR");
    mechToken = await seal(mech.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");
    strangerToken = await seal(stranger.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      const woIds = (await prisma.workOrder.findMany({ where: { vehicleId } })).map((w) => w.id);
      const invIds = (await prisma.invoice.findMany({ where: { workOrderId: { in: woIds } } })).map((i) => i.id);
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invIds } } });
      await prisma.invoice.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrderItem.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.wasteRecord.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrder.deleteMany({ where: { id: { in: woIds } } });
      const ids = (await prisma.inspection.findMany({ where: { vehicleId } })).map((i) => i.id);
      const scoreIds = (await prisma.healthScore.findMany({ where: { inspectionId: { in: ids } } })).map((s) => s.id);
      await prisma.recommendation.deleteMany({ where: { vehicleId } });
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

  const advisor = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${advisorToken}`);
  const mech = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${mechToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);
  const stranger = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${strangerToken}`);

  async function submitInspection(padValue: number): Promise<void> {
    const createUuid = randomUUID();
    const created = await mech().post("/api/v1/sync/batch").send({ items: [{ clientUuid: createUuid, entityType: "inspection", op: "create", payload: { vehicleId, checklistVersionId, odometerKm: 50000, results: inspectionResults(padValue) } }] }).expect(201);
    expect(created.body.data.results[0]).toMatchObject({ status: "APPLIED" });
    const submitted = await mech().post("/api/v1/sync/batch").send({ items: [{ clientUuid: randomUUID(), entityType: "inspection", op: "submit", payload: { inspectionClientUuid: createUuid } }] }).expect(201);
    // Surface a rejected submit here (with its error) instead of a mysterious missing recommendation later.
    expect(submitted.body.data.results[0]).toMatchObject({ status: "APPLIED" });
  }

  let woId: string;
  let padItemId: string;
  let recId: string;

  it("an inspection finding creates an open recommendation", async () => {
    await submitInspection(3.0); // ATTENTION
    const res = await advisor().get(`/api/v1/recommendations?vehicleId=${vehicleId}`).expect(200);
    const rec = res.body.data.find((r: any) => r.pointCode === "BRAKE_PAD_FRONT");
    expect(rec).toBeDefined();
    expect(rec.status).toBe("OPEN");
    recId = rec.id;
  });

  it("advisor opens a work order and converts the recommendation to a line above threshold", async () => {
    const created = await advisor().post("/api/v1/work-orders").send({ vehicleId, customerComplaint: "Squealing when braking" }).expect(201);
    woId = created.body.data.id;
    expect(created.body.data.number).toMatch(/^WO-\d{6}-\d{4}$/);

    // front pads part (₱1,550) + labour (₱800) → ₱2,350 > ₱1,500 threshold
    const withPart = await advisor().post(`/api/v1/work-orders/${woId}/items`).send({ type: "PART", partSku: "BRK-PAD-FR-STD", description: "Front brake pads", qty: 1, unitPriceCentavos: 0, recommendationId: recId }).expect(201);
    padItemId = withPart.body.data.items.find((i: any) => i.partSku === "BRK-PAD-FR-STD").id;
    expect(withPart.body.data.items[0].unitPriceCentavos).toBe(155000); // price defaulted from catalogue
    await advisor().post(`/api/v1/work-orders/${woId}/items`).send({ type: "LABOR", description: "Brake service labour", qty: 1, unitPriceCentavos: 80000 }).expect(201);
  });

  it("above-threshold DRAFT cannot jump straight to APPROVED (server-enforced, FR-067)", async () => {
    const res = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "APPROVED" }).expect(409);
    expect(res.body.error.code).toBe("APPROVAL_REQUIRED");
  });

  it("request-approval moves to AWAITING_APPROVAL; only the owner may decide lines", async () => {
    await advisor().post(`/api/v1/work-orders/${woId}/request-approval`).expect(201);
    const got = await advisor().get(`/api/v1/work-orders/${woId}`).expect(200);
    expect(got.body.data.status).toBe("AWAITING_APPROVAL");
    // stranger cannot decide
    await stranger().post(`/api/v1/work-orders/${woId}/items/${padItemId}/decision`).send({ decision: "APPROVED" }).expect(403);
  });

  it("member decisions set per-line status and the recommendation follows", async () => {
    const laborId = (await member().get(`/api/v1/work-orders/${woId}`)).body.data.items.find((i: any) => i.type === "LABOR").id;
    await member().post(`/api/v1/work-orders/${woId}/decisions`).send({
      decisions: [ { itemId: padItemId, decision: "APPROVED" }, { itemId: laborId, decision: "APPROVED" } ],
    }).expect(201);
    const rec = await prisma.recommendation.findUnique({ where: { id: recId } });
    expect(rec!.status).toBe("APPROVED");
  });

  it("advances APPROVED→IN_PROGRESS→QC→READY, then closes with summary + waste, issuing an invoice", async () => {
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "APPROVED" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "IN_PROGRESS" }).expect(200);
    // mark approved lines done
    const items = (await advisor().get(`/api/v1/work-orders/${woId}`)).body.data.items;
    for (const i of items.filter((x: any) => x.approvalStatus === "APPROVED")) {
      await advisor().patch(`/api/v1/work-orders/${woId}/items/${i.id}/done`).send({ done: true }).expect(200);
    }
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "QC" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "READY" }).expect(200);

    // close blocked without a technician summary
    const noSummary = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED" }).expect(409);
    expect(noSummary.body.error.code).toBe("SUMMARY_REQUIRED");

    const closed = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "Replaced front pads, road-tested OK." }).expect(200);
    expect(closed.body.data.status).toBe("CLOSED");

    const invoice = await prisma.invoice.findFirst({ where: { workOrderId: woId } });
    expect(invoice).not.toBeNull();
    expect(Number(invoice!.totalCentavos)).toBe(235000); // 1550 + 800 pesos
    const rec = await prisma.recommendation.findUnique({ where: { id: recId } });
    expect(rec!.status).toBe("RESOLVED");
  });

  it("closed work orders are immutable — no more items", async () => {
    const res = await advisor().post(`/api/v1/work-orders/${woId}/items`).send({ type: "LABOR", description: "late add", qty: 1, unitPriceCentavos: 10000 }).expect(409);
    expect(res.body.error.code).toBe("WORK_ORDER_IMMUTABLE");
  });

  it("a declined recommendation resurfaces at the next inspection with resurfacedCount incremented", async () => {
    // fresh inspection with a NEW brake finding, then decline it
    await submitInspection(2.9); // still ATTENTION
    const recs1 = (await advisor().get(`/api/v1/recommendations?vehicleId=${vehicleId}`)).body.data;
    const open = recs1.find((r: any) => r.pointCode === "BRAKE_PAD_FRONT" && ["OPEN", "QUOTED"].includes(r.status));
    expect(open).toBeDefined();

    const wo2 = (await advisor().post("/api/v1/work-orders").send({ vehicleId }).expect(201)).body.data;
    const item = (await advisor().post(`/api/v1/work-orders/${wo2.id}/items`).send({ type: "PART", partSku: "BRK-PAD-FR-STD", description: "Front pads", qty: 1, unitPriceCentavos: 0, recommendationId: open.id }).expect(201)).body.data.items[0];
    await advisor().post(`/api/v1/work-orders/${wo2.id}/request-approval`).expect(201);
    await member().post(`/api/v1/work-orders/${wo2.id}/items/${item.id}/decision`).send({ decision: "DECLINED" }).expect(201);

    const declined = await prisma.recommendation.findUnique({ where: { id: open.id } });
    expect(declined!.status).toBe("DECLINED");
    const before = declined!.resurfacedCount;

    await submitInspection(3.1); // next inspection, still adverse → resurfaces
    const after = await prisma.recommendation.findUnique({ where: { id: open.id } });
    expect(after!.status).toBe("OPEN");
    expect(after!.resurfacedCount).toBe(before + 1);
    // no duplicate created for the same vehicle+point
    const openCount = await prisma.recommendation.count({ where: { vehicleId, pointCode: "BRAKE_PAD_FRONT", status: { in: ["OPEN", "QUOTED", "DECLINED", "DEFERRED"] } } });
    expect(openCount).toBe(1);
  });
});
