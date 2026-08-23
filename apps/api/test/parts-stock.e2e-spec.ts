import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const TAG = `stk-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";
const SKU = `${TAG}-PART`;

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

describe("parts & stock (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let advisorToken: string;
  let adminToken: string;
  let memberToken: string;
  let vehicleId: string;

  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);

    const advisor = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    const admin = await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, role: "ADMIN" } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({ data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" } });
    vehicleId = vehicle.id;
    advisorToken = await seal(advisor.id, "ADVISOR");
    adminToken = await seal(admin.id, "ADMIN");
    memberToken = await seal(member.id, "MEMBER");
    // starter part with stock 3, reorder level 2
    await prisma.part.create({ data: { sku: SKU, name: `${TAG} widget`, category: "MISC", costCentavos: BigInt(10000), priceCentavos: BigInt(20000), stockQty: 3, reorderLevel: 2 } });
  });

  afterAll(async () => {
    try {
      const woIds = (await prisma.workOrder.findMany({ where: { vehicleId } })).map((w) => w.id);
      const invIds = (await prisma.invoice.findMany({ where: { workOrderId: { in: woIds } } })).map((i) => i.id);
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invIds } } });
      await prisma.invoice.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrderItem.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrder.deleteMany({ where: { id: { in: woIds } } });
      await prisma.part.deleteMany({ where: { sku: { startsWith: TAG } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: (await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } } })).map((u) => u.id) } } });
      await prisma.vehicle.deleteMany({ where: { plateNo: { startsWith: TAG } } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const advisor = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${advisorToken}`);
  const admin = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${adminToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  async function closableWorkOrder(qty: number, opts: { override?: boolean } = {}): Promise<string> {
    const wo = (await advisor().post("/api/v1/work-orders").send({ vehicleId }).expect(201)).body.data;
    const withItem = (await advisor().post(`/api/v1/work-orders/${wo.id}/items`).send({ type: "PART", partSku: SKU, description: "widget", qty, unitPriceCentavos: 20000 }).expect(201)).body.data;
    const itemId = withItem.items[0].id;
    // small total → straight to APPROVED, member approves the line, mark done, close
    await advisor().post(`/api/v1/work-orders/${wo.id}/request-approval`).expect(201);
    await member().post(`/api/v1/work-orders/${wo.id}/items/${itemId}/decision`).send({ decision: "APPROVED" }).expect(201);
    await advisor().patch(`/api/v1/work-orders/${wo.id}/status`).send({ status: "APPROVED" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${wo.id}/status`).send({ status: "IN_PROGRESS" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${wo.id}/items/${itemId}/done`).send({ done: true }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${wo.id}/status`).send({ status: "QC" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${wo.id}/status`).send({ status: "READY" }).expect(200);
    return wo.id;
  }

  it("closure decrements approved-part stock exactly once", async () => {
    const before = (await prisma.part.findUniqueOrThrow({ where: { sku: SKU } })).stockQty;
    const woId = await closableWorkOrder(2);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "done" }).expect(200);
    const after = (await prisma.part.findUniqueOrThrow({ where: { sku: SKU } })).stockQty;
    expect(after).toBe(before - 2);
    // re-closing is an illegal transition — no second decrement possible
    const recl = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "done" }).expect(409);
    expect(recl.body.error.code).toBe("ILLEGAL_TRANSITION");
    expect((await prisma.part.findUniqueOrThrow({ where: { sku: SKU } })).stockQty).toBe(before - 2);
  });

  it("closure that would drive stock negative is blocked without an override, allowed (and audited) with one", async () => {
    // stock is now 1; try to consume 3
    const woId = await closableWorkOrder(3);
    const blocked = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "done" }).expect(409);
    expect(blocked.body.error.code).toBe("STOCK_INSUFFICIENT");

    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "done", stockOverrideReason: "customer waiting; stock arriving tomorrow" }).expect(200);
    expect((await prisma.part.findUniqueOrThrow({ where: { sku: SKU } })).stockQty).toBe(-2);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "WorkOrder", action: "STOCK_NEGATIVE_OVERRIDE", entityId: woId } });
    expect(audit).not.toBeNull();
  });

  it("low-stock parts surface via the reorder flag", async () => {
    const res = await advisor().get("/api/v1/parts/low-stock").expect(200);
    const row = res.body.data.find((p: any) => p.sku === SKU);
    expect(row).toBeDefined(); // stock -2 ≤ reorder 2
    expect(row.lowStock).toBe(true);
  });

  it("admin can create and update parts; non-admin staff cannot", async () => {
    const newSku = `${TAG}-NEW`;
    await advisor().post("/api/v1/admin/parts").send({ sku: newSku, name: "x", category: "MISC", costCentavos: 100, priceCentavos: 200, stockQty: 5, reorderLevel: 1 }).expect(403);
    const created = await admin().post("/api/v1/admin/parts").send({ sku: newSku, name: "New part", category: "MISC", costCentavos: 100, priceCentavos: 200, stockQty: 5, reorderLevel: 1 }).expect(201);
    expect(created.body.data.sku).toBe(newSku);
    const updated = await admin().patch(`/api/v1/admin/parts/${newSku}`).send({ priceCentavos: 300 }).expect(200);
    expect(updated.body.data.priceCentavos).toBe(300);
  });

  it("parts search matches SKU and name for staff, forbidden for members", async () => {
    const res = await advisor().get(`/api/v1/parts?query=${TAG}`).expect(200);
    expect(res.body.data.some((p: any) => p.sku === SKU)).toBe(true);
    await member().get(`/api/v1/parts?query=${TAG}`).expect(403);
  });
});
