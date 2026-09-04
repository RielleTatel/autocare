import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RemindersService, dueReason, staggerBucket, bucketForDay, fnv1a, resolveBaselineDate } from "./reminders.service";
import { AnnouncementsService } from "../announcements/announcements.service";

const DAY = 86_400_000;

describe("reminders — pure helpers", () => {
  const now = new Date("2027-06-01T00:00:00Z");

  it("dueReason: TIME when interval days elapsed", () => {
    expect(dueReason({ now, baselineDate: new Date(now.getTime() - 200 * DAY), intervalDays: 180, currentOdometerKm: 0, baselineOdometerKm: 0, intervalKm: null })).toBe("TIME");
  });
  it("dueReason: ODOMETER when km delta met and time not", () => {
    expect(dueReason({ now, baselineDate: new Date(now.getTime() - 10 * DAY), intervalDays: 180, currentOdometerKm: 12000, baselineOdometerKm: 2000, intervalKm: 10000 })).toBe("ODOMETER");
  });
  it("dueReason: null when neither", () => {
    expect(dueReason({ now, baselineDate: new Date(now.getTime() - 10 * DAY), intervalDays: 180, currentOdometerKm: 100, baselineOdometerKm: 0, intervalKm: 10000 })).toBeNull();
  });
  it("dueReason: TIME wins when both apply", () => {
    expect(dueReason({ now, baselineDate: new Date(now.getTime() - 200 * DAY), intervalDays: 180, currentOdometerKm: 99999, baselineOdometerKm: 0, intervalKm: 10000 })).toBe("TIME");
  });

  it("stagger buckets are within 0..27 and roughly uniform over many ids", () => {
    const counts = new Array(28).fill(0);
    for (let i = 0; i < 2800; i++) counts[staggerBucket(randomUUID())]++;
    expect(counts.every((c) => c > 0)).toBe(true); // every bucket used
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max / min).toBeLessThan(3); // no wild skew (expected ~100/bucket)
  });

  it("fnv1a is deterministic", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(bucketForDay(new Date("2027-06-01T00:00:00Z"))).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveBaselineDate", () => {
  const completed = new Date("2026-06-01T00:00:00Z");
  const lastService = new Date("2026-03-01T00:00:00Z");
  const created = new Date("2026-01-01T00:00:00Z");

  it("prefers the last completed appointment", () => {
    expect(resolveBaselineDate(completed, lastService, created)).toEqual(completed);
  });

  it("falls back to the member-entered last-service date", () => {
    expect(resolveBaselineDate(undefined, lastService, created)).toEqual(lastService);
  });

  it("falls back to registration date when nothing else is known", () => {
    expect(resolveBaselineDate(undefined, null, created)).toEqual(created);
  });
});

describe("RemindersService — dueCandidates + staggered serviceDue (real DB)", () => {
  const TAG = `rem-${randomUUID().slice(0, 8)}`;
  const NOW = new Date("2027-06-15T00:00:00Z");
  let prisma: PrismaService;
  let service: RemindersService;
  let memberId: string;
  let dueVehicleId: string;
  let freshVehicleId: string;
  let serviceTypeId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new RemindersService(prisma, new AnnouncementsService(prisma));

    memberId = (await prisma.user.create({ data: { firebaseUid: `${TAG}-m`, role: "MEMBER" } })).id;
    serviceTypeId = (
      await prisma.serviceType.create({
        data: { code: `${TAG}-OIL`, name: "Oil", standardDurationMin: 60, requiredSkills: [], priceCentavos: 50000n, intervalDays: 180, intervalKm: 5000 },
      })
    ).id;

    // Due vehicle: registered 300 days ago (> 180d interval) → due by TIME.
    dueVehicleId = (
      await prisma.vehicle.create({
        data: { ownerUserId: memberId, plateNo: `RM${randomUUID().slice(0, 5).toUpperCase()}`, make: "T", model: "V", year: 2020, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 1000, createdAt: new Date(NOW.getTime() - 300 * DAY) },
      })
    ).id;
    // Fresh vehicle: registered today, low mileage → not due.
    freshVehicleId = (
      await prisma.vehicle.create({
        data: { ownerUserId: memberId, plateNo: `RM${randomUUID().slice(0, 5).toUpperCase()}`, make: "T", model: "V", year: 2020, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 100, createdAt: NOW },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.announcement.deleteMany({ where: { serviceTypeId } });
    await prisma.vehicle.deleteMany({ where: { id: { in: [dueVehicleId, freshVehicleId] } } });
    await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("dueCandidates flags the overdue vehicle, not the fresh one", async () => {
    const candidates = await service.dueCandidates(NOW);
    const mine = candidates.filter((c) => c.serviceTypeId === serviceTypeId);
    expect(mine.some((c) => c.vehicleId === dueVehicleId && c.reason === "TIME")).toBe(true);
    expect(mine.some((c) => c.vehicleId === freshVehicleId)).toBe(false);
  });

  it("serviceDue routes each due vehicle to exactly one send across a 28-day cycle", async () => {
    // Run every bucket day in the cycle; the due vehicle should get exactly one reminder total.
    const startEpochDay = Math.floor(NOW.getTime() / DAY);
    let total = 0;
    for (let d = 0; d < 28; d++) {
      const day = new Date((startEpochDay + d) * DAY);
      total += (await service.serviceDue(day)).created;
    }
    // Scoped to this spec's own vehicles: serviceDue() sweeps every ACTIVE
    // vehicle in the database, so any unrelated vehicle old enough to be due
    // (a hand-created one in a dev DB, say) would otherwise fail this.
    const threads = await prisma.announcement.findMany({
      where: { serviceTypeId, vehicleId: { in: [dueVehicleId, freshVehicleId] } },
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].vehicleId).toBe(dueVehicleId);
    expect(threads[0].kind).toBe("SERVICE_DUE");
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

describe("serviceDue writes announcement threads", () => {
  const vehicleId = "11111111-1111-1111-1111-111111111111";
  const NOW_T7 = new Date("2026-09-04T00:00:00Z");

  function stubPrisma() {
    return {
      vehicle: {
        findMany: jest.fn(async () => [
          { id: vehicleId, currentOdometerKm: 20000, createdAt: new Date("2020-01-01"), lastServiceAt: null, ownerUserId: "u1" },
        ]),
      },
      serviceType: {
        findMany: jest.fn(async () => [{ id: "s1", name: "Oil Change", intervalDays: 180, intervalKm: 5000 }]),
      },
      appointment: { findMany: jest.fn(async () => []) },
      odometerReading: { findMany: jest.fn(async () => [{ vehicleId, km: 0 }]) },
    } as any;
  }

  it("applies a SERVICE_DUE_DETECTED event per due candidate in today's bucket", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const svc = new RemindersService(stubPrisma(), { applyThreadEvent } as any);
    jest.spyOn(svc as any, "isInTodaysBucket").mockReturnValue(true);

    const result = await svc.serviceDue(NOW_T7);

    expect(result).toEqual({ created: 1 });
    expect(applyThreadEvent).toHaveBeenCalledTimes(1);
    expect(applyThreadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        vehicleId,
        serviceTypeId: "s1",
        serviceTypeName: "Oil Change",
        event: { type: "SERVICE_DUE_DETECTED" },
      }),
    );
  });

  it("skips candidates outside today's stagger bucket", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const svc = new RemindersService(stubPrisma(), { applyThreadEvent } as any);
    jest.spyOn(svc as any, "isInTodaysBucket").mockReturnValue(false);

    expect(await svc.serviceDue(NOW_T7)).toEqual({ created: 0 });
    expect(applyThreadEvent).not.toHaveBeenCalled();
  });

  it("skips org-owned vehicles — there is no single member to notify", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const prisma = stubPrisma();
    prisma.vehicle.findMany = jest.fn(async () => [
      { id: vehicleId, currentOdometerKm: 20000, createdAt: new Date("2020-01-01"), lastServiceAt: null, ownerUserId: null },
    ]);
    const svc = new RemindersService(prisma, { applyThreadEvent } as any);
    jest.spyOn(svc as any, "isInTodaysBucket").mockReturnValue(true);

    expect(await svc.serviceDue(NOW_T7)).toEqual({ created: 0 });
    expect(applyThreadEvent).not.toHaveBeenCalled();
  });
});
