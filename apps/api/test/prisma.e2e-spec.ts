import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("prisma (e2e)", () => {
  const prisma = new PrismaService();
  afterAll(async () => {
    // Delete the owned vehicle before the user: Prisma emulates the optional
    // ownerUserId FK as SET NULL on user deletion, which would otherwise
    // leave the vehicle with no owner and violate vehicles_single_owner_check.
    await prisma.vehicle.deleteMany({ where: { plateNo: "ABC1234" } });
    await prisma.user.deleteMany({ where: { firebaseUid: "test-uid" } });
    await prisma.$disconnect();
  });

  it("creates and reads a user with a vehicle", async () => {
    const user = await prisma.user.create({
      data: {
        firebaseUid: "test-uid",
        role: "MEMBER",
        vehicles: {
          create: { plateNo: "ABC1234", make: "Toyota", model: "Vios", year: 2019, fuelType: "GASOLINE", transmission: "AT" },
        },
      },
      include: { vehicles: true },
    });
    expect(user.vehicles[0].plateNo).toBe("ABC1234");
  });
});
