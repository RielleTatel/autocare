import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const TAG = `wst-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";
const OIL_SKU = `${TAG}-OIL`;

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

describe("waste capture (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let advisorToken: string;
  let mechToken: string;
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
    const mech = await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC", isCertifiedTechnician: true } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    const vehicle = await prisma.vehicle.create({ data: { ownerUserId: member.id, plateNo: `${TAG}-PL`, make: "Toyota", model: "Vios", year: 2020, fuelType: "GAS", transmission: "AT" } });
    vehicleId = vehicle.id;
    advisorToken = await seal(advisor.id, "ADVISOR");
    mechToken = await seal(mech.id, "MECHANIC");
    memberToken = await seal(member.id, "MEMBER");
    await prisma.part.create({ data: { sku: OIL_SKU, name: `${TAG} oil`, category: "OIL", costCentavos: BigInt(30000), priceCentavos: BigInt(52000), stockQty: 20, reorderLevel: 5 } });
  });

  afterAll(async () => {
    try {
      const woIds = (await prisma.workOrder.findMany({ where: { vehicleId } })).map((w) => w.id);
      const invIds = (await prisma.invoice.findMany({ where: { workOrderId: { in: woIds } } })).map((i) => i.id);
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invIds } } });
      await prisma.invoice.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.wasteRecord.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrderItem.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrder.deleteMany({ where: { id: { in: woIds } } });
      await prisma.part.deleteMany({ where: { sku: { startsWith: TAG } } });
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

  let woId: string;
  let itemId: string;

  it("builds an oil-change work order and readies it", async () => {
    woId = (await advisor().post("/api/v1/work-orders").send({ vehicleId }).expect(201)).body.data.id;
    itemId = (await advisor().post(`/api/v1/work-orders/${woId}/items`).send({ type: "PART", partSku: OIL_SKU, description: "Engine oil x4", qty: 4, unitPriceCentavos: 52000 }).expect(201)).body.data.items[0].id;
    await advisor().post(`/api/v1/work-orders/${woId}/request-approval`).expect(201);
    await member().post(`/api/v1/work-orders/${woId}/items/${itemId}/decision`).send({ decision: "APPROVED" }).expect(201);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "APPROVED" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "IN_PROGRESS" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/items/${itemId}/done`).send({ done: true }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "QC" }).expect(200);
    await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "READY" }).expect(200);
  });

  it("an oil-change work order cannot close without a USED_OIL waste record", async () => {
    const res = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "oil changed" }).expect(409);
    expect(res.body.error.code).toBe("WASTE_REQUIRED");
    expect(res.body.error.details.wasteType).toBe("USED_OIL");
  });

  it("an offline waste record syncs through /sync/batch and unblocks closure", async () => {
    const clientUuid = randomUUID();
    const res = await mech().post("/api/v1/sync/batch").send({
      items: [{ clientUuid, entityType: "waste_record", op: "create", payload: { workOrderId: woId, wasteType: "USED_OIL", quantity: 4.5, unit: "L" } }],
    }).expect(201);
    expect(res.body.data.results[0].status).toBe("APPLIED");
    // replay is idempotent
    const replay = await mech().post("/api/v1/sync/batch").send({
      items: [{ clientUuid, entityType: "waste_record", op: "create", payload: { workOrderId: woId, wasteType: "USED_OIL", quantity: 4.5, unit: "L" } }],
    }).expect(201);
    expect(replay.body.data.results[0].status).toBe("DUPLICATE");
    expect(await prisma.wasteRecord.count({ where: { workOrderId: woId } })).toBe(1);

    // now closure succeeds
    const closed = await advisor().patch(`/api/v1/work-orders/${woId}/status`).send({ status: "CLOSED", technicianSummary: "oil changed, waste hauled" }).expect(200);
    expect(closed.body.data.status).toBe("CLOSED");
  });

  it("advisor can also add a waste record directly (W-09) with hauler + manifest", async () => {
    const wo = (await advisor().post("/api/v1/work-orders").send({ vehicleId }).expect(201)).body.data;
    const res = await advisor().post(`/api/v1/work-orders/${wo.id}/waste`).send({ wasteType: "BATTERY", quantity: 1, unit: "pcs", haulerName: "EcoWaste PH", manifestNo: "MF-2026-001" }).expect(201);
    const rec = res.body.data.wasteRecords.find((w: any) => w.wasteType === "BATTERY");
    expect(rec).toBeDefined();
    expect(rec.manifestNo).toBe("MF-2026-001");
  });
});
