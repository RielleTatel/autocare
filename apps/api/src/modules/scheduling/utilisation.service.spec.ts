import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UtilisationService, UTILISATION_ALARM_THRESHOLD } from "./utilisation.service";
import { computeDayUtilisation } from "./utilisation";
import { Clock } from "../../common/clock/clock";

describe("utilisation — pure math (FR-052)", () => {
  it("ratio = booked / available with available = window hours × min(bays, mechanics)", () => {
    const u = computeDayUtilisation({ date: "2027-07-01", operatingWindow: { open: "09:00", close: "17:00" }, activeBays: 2, mechanicsOnShift: 3, bookedCount: 6 });
    expect(u.available).toBe(16); // 8h × min(2,3)=2
    expect(u.ratio).toBeCloseTo(6 / 16);
  });
  it("closed / unstaffed day is 0 available and 0 ratio", () => {
    expect(computeDayUtilisation({ date: "d", operatingWindow: null, activeBays: 2, mechanicsOnShift: 2, bookedCount: 3 }).available).toBe(0);
    expect(computeDayUtilisation({ date: "d", operatingWindow: { open: "09:00", close: "17:00" }, activeBays: 0, mechanicsOnShift: 2, bookedCount: 3 }).ratio).toBe(0);
  });
  it("mechanics cap availability below bays", () => {
    const u = computeDayUtilisation({ date: "d", operatingWindow: { open: "09:00", close: "12:00" }, activeBays: 5, mechanicsOnShift: 1, bookedCount: 0 });
    expect(u.available).toBe(3); // 3h × min(5,1)=1
  });
});

describe("UtilisationService — alarm (real DB)", () => {
  const TAG = `util-${randomUUID().slice(0, 8)}`;
  const NOW = new Date("2027-07-05T02:00:00Z");
  const clock: Clock = { now: () => NOW };
  const DATE = "2027-07-05"; // Manila date of NOW
  let prisma: PrismaService;
  let service: UtilisationService;
  const mechId = randomUUID();
  const vehicleIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new UtilisationService(prisma, clock);

    await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });
    await prisma.user.create({ data: { id: mechId, firebaseUid: `${TAG}-mech`, role: "MECHANIC" } });
    const owner = await prisma.user.create({ data: { firebaseUid: `${TAG}-m`, role: "MEMBER" } });
    const bay = await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } });
    const st = await prisma.serviceType.create({ data: { code: `${TAG}-OIL`, name: "Oil", standardDurationMin: 60, requiredSkills: ["OIL"], priceCentavos: 1000n } });

    // Tiny capacity: 1 bay, 1 mechanic, 09:00-11:00 → available = 2. Book 2 → ratio 1.0 > 0.85.
    await prisma.operatingHours.create({ data: { dateOverride: DATE, openTime: "09:00", closeTime: "11:00", walkInBufferPct: 0 } });
    await prisma.staffShift.create({ data: { userId: mechId, date: DATE, startTime: "09:00", endTime: "11:00", skills: ["OIL"] } });
    for (const hh of ["09:00", "10:00"]) {
      const v = await prisma.vehicle.create({ data: { ownerUserId: owner.id, plateNo: `UT${randomUUID().slice(0, 5).toUpperCase()}`, make: "T", model: "V", year: 2020, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 } });
      vehicleIds.push(v.id);
      await prisma.appointment.create({
        data: { vehicleId: v.id, serviceTypeId: st.id, bayId: bay.id, createdBy: owner.id, scheduledStart: new Date(`${DATE}T${hh}:00+08:00`), scheduledEnd: new Date(`${DATE}T${hh}:00+08:00`), status: "BOOKED" },
      });
    }
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.serviceType.deleteMany({ where: { code: { startsWith: TAG } } });
    await prisma.serviceBay.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.staffShift.deleteMany({ where: { userId: mechId } });
    await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });
    await prisma.auditLog.deleteMany({ where: { entityType: "Capacity", entityId: DATE } });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("forWindow reports the overbooked day and the alarm writes an audit row", async () => {
    const rows = await service.forWindow(DATE, 1);
    expect(rows[0].available).toBe(2);
    expect(rows[0].booked).toBe(2);
    expect(rows[0].ratio).toBeGreaterThan(UTILISATION_ALARM_THRESHOLD);

    const res = await service.utilisationAlarm(NOW);
    expect(res.breached).toBeGreaterThanOrEqual(1);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Capacity", entityId: DATE, action: "UTILISATION_ALARM" } });
    expect(audit).not.toBeNull();
  });
});
