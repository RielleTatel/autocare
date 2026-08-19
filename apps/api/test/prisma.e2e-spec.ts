import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("prisma (e2e)", () => {
  const prisma = new PrismaService();
  afterAll(async () => {
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
