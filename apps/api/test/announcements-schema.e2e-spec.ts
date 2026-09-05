import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = `annschema-${randomUUID().slice(0, 8)}`;

/**
 * Guards the one piece of the announcements schema Prisma cannot express and therefore cannot
 * regenerate: the partial unique index that allows exactly one OPEN thread per
 * (member, vehicle, service type) while leaving closed threads in place as history.
 *
 * vehicle_id is a real foreign key, so these use an actual vehicle row. user_id and
 * service_type_id are deliberately unconstrained columns, so random uuids are fine there and
 * let each test own an isolated thread key.
 */
describe("announcements schema", () => {
  let vehicleId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({ data: { firebaseUid: `${TAG}-owner`, role: "MEMBER" } });
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerUserId: owner.id,
        plateNo: `AN${randomUUID().slice(0, 5).toUpperCase()}`,
        make: "Toyota", model: "Vios", year: 2022,
        fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.announcement.deleteMany({ where: { vehicleId } });
    await prisma.announcement.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("has a partial unique index scoped to ACTIVE threads", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'announcements_open_thread'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("WHERE (status = 'ACTIVE'");
  });

  it("rejects a second OPEN thread for the same (user, vehicle, service type)", async () => {
    const key = { userId: randomUUID(), vehicleId, serviceTypeId: randomUUID() };
    await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} due`, body: "x" },
    });

    await expect(
      prisma.announcement.create({
        data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} dup`, body: "x" },
      }),
    ).rejects.toThrow();
  });

  it("allows a new OPEN thread once the previous one is closed — the next service cycle", async () => {
    const key = { userId: randomUUID(), vehicleId, serviceTypeId: randomUUID() };
    const first = await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} cycle1`, body: "x" },
    });
    await prisma.announcement.update({ where: { id: first.id }, data: { status: "SUPERSEDED" } });

    // This is the case a TOTAL unique constraint would wrongly block.
    const second = await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} cycle2`, body: "x" },
    });
    expect(second.id).not.toBe(first.id);
  });

  it("lets many broadcasts coexist — their thread key is all-null", async () => {
    const a = await prisma.announcement.create({
      data: { kind: "ADMIN_BROADCAST", status: "ACTIVE", title: `${TAG} b1`, body: "x" },
    });
    const b = await prisma.announcement.create({
      data: { kind: "ADMIN_BROADCAST", status: "ACTIVE", title: `${TAG} b2`, body: "x" },
    });
    expect(a.id).not.toBe(b.id);
  });

  it("deletes a vehicle's threads with the vehicle, but never a broadcast", async () => {
    const owner = await prisma.user.create({ data: { firebaseUid: `${TAG}-owner2`, role: "MEMBER" } });
    const doomed = await prisma.vehicle.create({
      data: {
        ownerUserId: owner.id, plateNo: `AX${randomUUID().slice(0, 5).toUpperCase()}`,
        make: "Toyota", model: "Vios", year: 2022,
        fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0,
      },
    });
    const thread = await prisma.announcement.create({
      data: {
        userId: owner.id, vehicleId: doomed.id, serviceTypeId: randomUUID(),
        kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} doomed`, body: "x",
      },
    });
    const broadcast = await prisma.announcement.create({
      data: { kind: "ADMIN_BROADCAST", status: "ACTIVE", title: `${TAG} survives`, body: "x" },
    });

    await prisma.vehicle.delete({ where: { id: doomed.id } });

    // Before the cascade this row survived with vehicle_id NULL and kept telling the member a
    // service was due on a car they no longer owned.
    expect(await prisma.announcement.findUnique({ where: { id: thread.id } })).toBeNull();
    expect(await prisma.announcement.findUnique({ where: { id: broadcast.id } })).not.toBeNull();

    await prisma.announcement.delete({ where: { id: broadcast.id } });
    await prisma.user.delete({ where: { id: owner.id } });
  });

});