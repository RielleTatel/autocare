import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "../entitlements/entitlement.service";
import { AppointmentsService } from "./appointments.service";
import { HoldsService, HoldDetails } from "./holds.service";
import { Clock } from "../../common/clock/clock";
import { AbilityUser } from "../../common/policies/ability.factory";

/**
 * Real DB (shared test Postgres via apps/api/.env), fake clock, stubbed HoldsService — the 24h
 * reschedule/cancel rules and no-show flagging are time-driven and don't need live Redis.
 */
// Remote Supabase latency + several sequential writes per test exceed the default 5s budget.
jest.setTimeout(30000);

describe("AppointmentsService — cutoffs, refunds, no-shows (real DB)", () => {
  const TAG = `apptsvc-${randomUUID().slice(0, 8)}`;
  const NOW = new Date("2027-05-01T02:00:00.000Z");
  const clock: Clock = { now: () => NOW };

  let prisma: PrismaService;
  let service: AppointmentsService;
  let entitlements: EntitlementService;
  let nextClaim: HoldDetails;
  const holdsStub = {
    claim: async () => nextClaim,
    restore: async () => undefined,
  } as unknown as HoldsService;

  let memberId: string;
  let advisorId: string;
  let vehicleId: string;
  let subId: string;
  let serviceTypeId: string;
  let bayId: string;

  const member = (): AbilityUser => ({ id: memberId, role: "MEMBER" });
  const advisor = (): AbilityUser => ({ id: advisorId, role: "ADVISOR" });

  const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
  const H = 60 * 60 * 1000;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    entitlements = new EntitlementService(prisma);
    service = new AppointmentsService(prisma, holdsStub, entitlements, clock);

    const m = await prisma.user.create({ data: { firebaseUid: `${TAG}-m`, role: "MEMBER" } });
    memberId = m.id;
    const a = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    advisorId = a.id;

    const st = await prisma.serviceType.create({
      data: { code: `${TAG}-INSP`, name: "Inspection", standardDurationMin: 60, requiredSkills: ["OIL"], priceCentavos: 50000n, entitlementType: "INSPECTION" },
    });
    serviceTypeId = st.id;
    bayId = (await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } })).id;

    const vehicle = await prisma.vehicle.create({
      data: { ownerUserId: memberId, plateNo: `AS${randomUUID().slice(0, 5).toUpperCase()}`, make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0 },
    });
    vehicleId = vehicle.id;
    const plan = await prisma.plan.create({
      data: {
        code: `${TAG}-P`, name: "Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1,
        entitlements: { create: [{ entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 15000n }] },
      },
    });
    subId = (
      await prisma.subscription.create({
        data: {
          vehicleId, planId: plan.id, userId: memberId, status: "ACTIVE",
          startedAt: NOW, lockInEndsAt: new Date(NOW.getTime() + 180 * 86400000),
          currentPeriodStart: NOW, currentPeriodEnd: new Date(NOW.getTime() + 30 * 86400000), paymentMethod: "E_PAYMENT",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { vehicleId } });
    await prisma.entitlementUsage.deleteMany({ where: { subscriptionId: subId } });
    await prisma.subscription.deleteMany({ where: { id: subId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: { startsWith: TAG } } } });
    await prisma.plan.deleteMany({ where: { code: { startsWith: TAG } } });
    await prisma.serviceBay.deleteMany({ where: { id: bayId } });
    await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
    await prisma.auditLog.deleteMany({ where: { entityId: vehicleId } });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  const makeAppt = (startOffsetMs: number, extra: Record<string, unknown> = {}) =>
    prisma.appointment.create({
      data: {
        vehicleId, serviceTypeId, bayId, createdBy: memberId,
        scheduledStart: new Date(NOW.getTime() + startOffsetMs),
        scheduledEnd: new Date(NOW.getTime() + startOffsetMs + H),
        ...extra,
      },
    });

  it("member CAN reschedule an appointment more than 24h out", async () => {
    const appt = await makeAppt(48 * H);
    nextClaim = { bayId, startIso: iso(72 * H), endIso: iso(73 * H), userId: memberId, serviceTypeId };
    const res = await service.reschedule(member(), appt.id, { holdId: "x" });
    expect(new Date(res.scheduledStart).toISOString()).toBe(iso(72 * H));
  });

  it("member CANNOT reschedule within 24h; an advisor can", async () => {
    const appt = await makeAppt(1 * H);
    nextClaim = { bayId, startIso: iso(100 * H), endIso: iso(101 * H), userId: memberId, serviceTypeId };
    await expect(service.reschedule(member(), appt.id, { holdId: "x" })).rejects.toMatchObject({ code: "FORBIDDEN_ROLE" });

    nextClaim = { bayId, startIso: iso(101 * H), endIso: iso(102 * H), userId: advisorId, serviceTypeId };
    const res = await service.reschedule(advisor(), appt.id, { holdId: "x" });
    expect(new Date(res.scheduledStart).toISOString()).toBe(iso(101 * H));
  });

  it("cancelling >24h out refunds the entitlement; within 24h does not", async () => {
    // Consume twice so we can observe a refund back down.
    await entitlements.consume(subId, "INSPECTION", 1);
    await entitlements.consume(subId, "INSPECTION", 1);
    const usedBefore = await prisma.entitlementUsage.findFirstOrThrow({ where: { subscriptionId: subId, entitlementType: "INSPECTION" } });
    expect(usedBefore.usedQty).toBe(2);

    const far = await makeAppt(48 * H, { subscriptionId: subId });
    await service.cancel(member(), far.id);
    const afterRefund = await prisma.entitlementUsage.findFirstOrThrow({ where: { subscriptionId: subId, entitlementType: "INSPECTION" } });
    expect(afterRefund.usedQty).toBe(1); // refunded one

    const near = await makeAppt(1 * H, { subscriptionId: subId });
    await service.cancel(member(), near.id);
    const afterNoRefund = await prisma.entitlementUsage.findFirstOrThrow({ where: { subscriptionId: subId, entitlementType: "INSPECTION" } });
    expect(afterNoRefund.usedQty).toBe(1); // unchanged
  });

  it("flagNoShows marks past BOOKED/CONFIRMED appointments NO_SHOW", async () => {
    const past = await makeAppt(-48 * H); // ended in the past relative to NOW
    const future = await makeAppt(24 * H);
    const result = await service.flagNoShows(NOW);
    expect(result.flagged).toBeGreaterThanOrEqual(1);

    const pastRow = await prisma.appointment.findUniqueOrThrow({ where: { id: past.id } });
    const futureRow = await prisma.appointment.findUniqueOrThrow({ where: { id: future.id } });
    expect(pastRow.status).toBe("NO_SHOW");
    expect(futureRow.status).toBe("BOOKED");
  });
});
