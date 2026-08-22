import { existsSync } from "fs";
import { join } from "path";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("invoices (e2e)", () => {
  let app: any, prisma: PrismaService;
  const planCode = "E2E-INV-BASIC";
  let planId: string;
  let vehicleId: string;
  const uids = ["inv-owner-a", "inv-owner-b"];

  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);

    for (const uid of uids) {
      await prisma.user.create({ data: { firebaseUid: uid, role: "MEMBER",
        consents: { create: { policyVersion: "2026-08-privacy-v1" } } } });
    }

    const plan = await prisma.plan.create({ data: { code: planCode, name: "Basic", priceCentavos: 112000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1 } });
    planId = plan.id;

    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: "inv-owner-a" } });
    const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: "INV0001",
      make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000 } });
    vehicleId = v.id;
  });

  afterAll(async () => {
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { vehicleId } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { vehicleId } } });
    await prisma.subscription.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.plan.deleteMany({ where: { code: planCode } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
    await app.close();
  });

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);

  let subscriptionId: string;
  let invoiceId: string;

  it("creates a subscription, which issues an invoice", async () => {
    const res = await as("inv-owner-a").post("/api/v1/subscriptions").set("Idempotency-Key", randomUUID())
      .send({ vehicleId, planId, paymentMethod: "E_PAYMENT" }).expect(201);
    subscriptionId = res.body.data.id;
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId } });
    invoiceId = invoice.id;
  });

  it("GET /invoices lists the owner's invoices with integer-centavos money", async () => {
    const res = await as("inv-owner-a").get("/api/v1/invoices").expect(200);
    const found = res.body.data.find((i: any) => i.id === invoiceId);
    expect(found).toBeDefined();
    expect(typeof found.totalCentavos).toBe("number");
    expect(found.totalCentavos).toBe(112000);
    expect(Array.isArray(found.items)).toBe(true);
    expect(typeof found.items[0].unitPriceCentavos).toBe("number");
  });

  it("GET /invoices/:id is ownership-checked: owner sees it, a different member gets 403", async () => {
    const res = await as("inv-owner-a").get(`/api/v1/invoices/${invoiceId}`).expect(200);
    expect(res.body.data.id).toBe(invoiceId);
    expect(res.body.data.totalCentavos).toBe(112000);

    await as("inv-owner-b").get(`/api/v1/invoices/${invoiceId}`).expect(403);
  });

  it("GET /invoices/:id/pdf generates the PDF on first call, stores it via the storage port, and returns a signed URL", async () => {
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(before.pdfObjectPath).toBeNull();

    const res = await as("inv-owner-a").get(`/api/v1/invoices/${invoiceId}/pdf`).expect(200);
    expect(typeof res.body.data.url).toBe("string");
    expect(res.body.data.url.length).toBeGreaterThan(0);

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(after.pdfObjectPath).toBe(`invoices/${invoiceId}/${after.number}.pdf`);

    // FsStorageAdapter (test env) actually wrote the file under apps/api/.storage/.
    const filePath = join(process.cwd(), ".storage", after.pdfObjectPath as string);
    expect(existsSync(filePath)).toBe(true);
  });

  it("GET /invoices/:id/pdf on a second call reuses the already-rendered object path", async () => {
    const first = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const res = await as("inv-owner-a").get(`/api/v1/invoices/${invoiceId}/pdf`).expect(200);
    expect(typeof res.body.data.url).toBe("string");
    const second = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(second.pdfObjectPath).toBe(first.pdfObjectPath);
  });

  it("a different member cannot generate/download another owner's invoice PDF — 403", async () => {
    await as("inv-owner-b").get(`/api/v1/invoices/${invoiceId}/pdf`).expect(403);
  });
});
