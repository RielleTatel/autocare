import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("vehicles (e2e)", () => {
  let app: any, prisma: PrismaService, vehicleId: string;
  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);
    for (const [uid, role] of [["veh-a", "MEMBER"], ["veh-b", "MEMBER"], ["veh-mech", "MECHANIC"]] as const) {
      await prisma.user.create({ data: { firebaseUid: uid, role,
        consents: role === "MEMBER" ? { create: { policyVersion: "2026-08-privacy-v1" } } : undefined } });
    }
  });
  afterAll(async () => {
    await prisma.odometerReading.deleteMany({ where: { vehicle: { plateNo: { in: ["XYZ7890"] } } } });
    await prisma.vehicle.deleteMany({ where: { plateNo: "XYZ7890" } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: ["veh-a", "veh-b"] } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: ["veh-a", "veh-b", "veh-mech"] } } });
    await app.close();
  });
  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);
  const body = { plateNo: "XYZ 7890", make: "Honda", model: "City", year: 2021, fuelType: "GASOLINE", transmission: "CVT", odometerKm: 15000 };

  it("creates a vehicle with normalized plate and initial odometer reading (FR-003/004)", async () => {
    const res = await as("veh-a").post("/api/v1/vehicles").send(body).expect(201);
    vehicleId = res.body.data.id;
    expect(res.body.data.plateNo).toBe("XYZ7890");
    expect(res.body.data.currentOdometerKm).toBe(15000);
    expect(res.body.data.ownerUserId).toBeUndefined();
    expect(res.body.data.orgOwnerId).toBeUndefined();
  });
  it("rejects a duplicate plate with 409 PLATE_ALREADY_REGISTERED (FR-005)", async () => {
    const res = await as("veh-b").post("/api/v1/vehicles").send(body).expect(409);
    expect(res.body.error.code).toBe("PLATE_ALREADY_REGISTERED");
  });
  it("rejects an invalid plate with 400", async () => {
    await as("veh-a").post("/api/v1/vehicles").send({ ...body, plateNo: "1234ABC" }).expect(400);
  });
  it("another member cannot read or update it", async () => {
    await as("veh-b").get(`/api/v1/vehicles/${vehicleId}`).expect(403);
    await as("veh-b").patch(`/api/v1/vehicles/${vehicleId}`).send({ color: "red" }).expect(403);
  });
  it("staff can read but not update (FR-007)", async () => {
    const res = await as("veh-mech").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
    expect(res.body.data.ownerUserId).toBeUndefined();
    expect(res.body.data.orgOwnerId).toBeUndefined();
    await as("veh-mech").patch(`/api/v1/vehicles/${vehicleId}`).send({ color: "red" }).expect(403);
  });
  it("odometer regression is 422 without justification, accepted with one (FR-048, NFR-056)", async () => {
    const r1 = await as("veh-a").post(`/api/v1/vehicles/${vehicleId}/odometer`).send({ km: 14000 }).expect(422);
    expect(r1.body.error.code).toBe("ODOMETER_REGRESSION");
    await as("veh-a").post(`/api/v1/vehicles/${vehicleId}/odometer`).send({ km: 14000, justification: "odometer cluster replaced" }).expect(201);
    const v = await as("veh-a").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
    expect(v.body.data.currentOdometerKm).toBe(14000);
  });
  it("list responses never include internal owner fields", async () => {
    const list = await as("veh-a").get("/api/v1/vehicles").expect(200);
    for (const v of list.body.data) {
      expect(v.ownerUserId).toBeUndefined();
      expect(v.orgOwnerId).toBeUndefined();
    }
  });
  it("DELETE archives; archived is absent from list but staff still GET it (FR-006 note)", async () => {
    await as("veh-a").del(`/api/v1/vehicles/${vehicleId}`).expect(200);
    const list = await as("veh-a").get("/api/v1/vehicles").expect(200);
    expect(list.body.data.find((v: any) => v.id === vehicleId)).toBeUndefined();
    await as("veh-mech").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
  });
});
