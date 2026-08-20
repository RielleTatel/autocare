import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("phase 1 schema (e2e)", () => {
  const prisma = new PrismaService();
  afterAll(async () => {
    await prisma.vehicle.deleteMany({ where: { plateNo: { in: ["ORG9999", "DUO8888"] } } });
    await prisma.organization.deleteMany({ where: { name: "Test Fleet Co" } });
    await prisma.user.deleteMany({ where: { firebaseUid: "schema-test-uid" } });
    await prisma.$disconnect();
  });

  it("creates an org-owned vehicle with photo arrays", async () => {
    const org = await prisma.organization.create({ data: { name: "Test Fleet Co", type: "FLEET" } });
    const v = await prisma.vehicle.create({
      data: { orgOwnerId: org.id, plateNo: "ORG9999", make: "Isuzu", model: "Traviz", year: 2022,
              fuelType: "DIESEL", transmission: "MT", photoUrls: ["https://x/1.jpg"], orCrUrls: [] },
    });
    expect(v.photoUrls).toEqual(["https://x/1.jpg"]);
  });

  it("check constraint rejects a vehicle with both owners", async () => {
    const user = await prisma.user.create({ data: { firebaseUid: "schema-test-uid" } });
    const org = await prisma.organization.findFirstOrThrow({ where: { name: "Test Fleet Co" } });
    await expect(prisma.vehicle.create({
      data: { ownerUserId: user.id, orgOwnerId: org.id, plateNo: "DUO8888", make: "T", model: "V",
              year: 2020, fuelType: "GASOLINE", transmission: "AT" },
    })).rejects.toThrow();
  });

  it("check constraint rejects a vehicle with no owner", async () => {
    await expect(prisma.vehicle.create({
      data: { plateNo: "DUO8888", make: "T", model: "V", year: 2020, fuelType: "GASOLINE", transmission: "AT" },
    })).rejects.toThrow();
  });
});
