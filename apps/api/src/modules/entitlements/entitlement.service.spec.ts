import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "./entitlement.service";

/**
 * Hits the real test Postgres (same DB the e2e suites use, via apps/api/.env) — the
 * concurrency assertion is only meaningful against real row-level locking, not a mock.
 */
describe("EntitlementService (real DB)", () => {
  let prisma: PrismaService;
  let service: EntitlementService;

  const planCode = `E2E-ENT-${randomUUID().slice(0, 8)}`;
  let planId: string;
  let userId: string;
  const vehicleIds: string[] = [];

  // One ACTIVE subscription per vehicle is enforced by a partial unique index — each test needs
  // its own vehicle so subscriptions created across tests don't collide on that constraint.
  const makeSubscription = async (overrides: Partial<{ status: string; quantityPerCycle: number }> = {}) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerUserId: userId, plateNo: `ENT${randomUUID().slice(0, 5).toUpperCase()}`,
        make: "Toyota", model: "Vios", year: 2022, fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0,
      },
    });
    vehicleIds.push(vehicle.id);

    const now = new Date();
    const sub = await prisma.subscription.create({
      data: {
        vehicleId: vehicle.id,
        planId,
        userId,
        status: (overrides.status ?? "ACTIVE") as any,
        startedAt: now,
        lockInEndsAt: new Date(now.getTime() + 180 * 86400000),
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
        paymentMethod: "E_PAYMENT",
      },
    });
    return sub;
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new EntitlementService(prisma);

    const user = await prisma.user.create({ data: { firebaseUid: `ent-${randomUUID()}`, role: "MEMBER" } });
    userId = user.id;

    const plan = await prisma.plan.create({
      data: {
        code: planCode, name: "Entitlement Test Plan", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 6, version: 1,
        entitlements: {
          create: [
            { entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 15000n },
          ],
        },
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await prisma.entitlementUsage.deleteMany({ where: { subscription: { vehicleId: { in: vehicleIds } } } });
    await prisma.subscription.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: planCode } } });
    await prisma.plan.deleteMany({ where: { code: planCode } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("consumes up to quota then reports EXHAUSTED with the plan's overage price", async () => {
    const sub = await makeSubscription();

    const first = await service.consume(sub.id, "INSPECTION", 1);
    expect(first).toEqual({ ok: true });
    const second = await service.consume(sub.id, "INSPECTION", 1);
    expect(second).toEqual({ ok: true });

    const third = await service.consume(sub.id, "INSPECTION", 1);
    expect(third).toEqual({ ok: false, reason: "EXHAUSTED", overagePriceCentavos: 15000 });

    const row = await prisma.entitlementUsage.findFirst({ where: { subscriptionId: sub.id, entitlementType: "INSPECTION" } });
    expect(row?.usedQty).toBe(2);
  });

  it("EXHAUSTED with overagePriceCentavos 0 when the plan has no PlanEntitlement for that type", async () => {
    const sub = await makeSubscription();
    const result = await service.consume(sub.id, "ROADSIDE", 1);
    expect(result).toEqual({ ok: false, reason: "EXHAUSTED", overagePriceCentavos: 0 });
  });

  it("blocks consumption when the subscription is SUSPENDED (no increment)", async () => {
    const sub = await makeSubscription({ status: "SUSPENDED" });
    const result = await service.consume(sub.id, "INSPECTION", 1);
    expect(result).toEqual({ ok: false, reason: "SUSPENDED" });

    const row = await prisma.entitlementUsage.findFirst({ where: { subscriptionId: sub.id, entitlementType: "INSPECTION" } });
    expect(row).toBeNull();
  });

  it("GRACE subscription still allows consumption (FR-027 — only SUSPENDED blocks)", async () => {
    const sub = await makeSubscription({ status: "GRACE" });
    const result = await service.consume(sub.id, "INSPECTION", 1);
    expect(result).toEqual({ ok: true });
  });

  it("concurrent consume calls never push usedQty past quota", async () => {
    const sub = await makeSubscription(); // quota = 2

    const results = await Promise.all([
      service.consume(sub.id, "INSPECTION", 1),
      service.consume(sub.id, "INSPECTION", 1),
      service.consume(sub.id, "INSPECTION", 1),
      service.consume(sub.id, "INSPECTION", 1),
      service.consume(sub.id, "INSPECTION", 1),
    ]);

    const okCount = results.filter((r) => r.ok).length;
    const exhaustedCount = results.filter((r) => !r.ok && r.reason === "EXHAUSTED").length;
    expect(okCount).toBe(2);
    expect(exhaustedCount).toBe(3);

    const row = await prisma.entitlementUsage.findFirst({ where: { subscriptionId: sub.id, entitlementType: "INSPECTION" } });
    expect(row?.usedQty).toBe(2); // never exceeds quota
  });

  it("usageFor reports usedQty and remaining per plan entitlement", async () => {
    const sub = await makeSubscription();
    await service.consume(sub.id, "INSPECTION", 1);

    const usage = await service.usageFor(sub.id);
    expect(usage).toEqual([{ entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 1, remaining: 1 }]);
  });

  it("resetCycle seeds fresh usage rows and is idempotent", async () => {
    const sub = await makeSubscription();
    await service.consume(sub.id, "INSPECTION", 2); // exhaust current period

    const newPeriodStart = new Date(sub.currentPeriodEnd.getTime());
    await service.resetCycle(sub.id, newPeriodStart);
    await service.resetCycle(sub.id, newPeriodStart); // idempotent re-run

    const rows = await prisma.entitlementUsage.findMany({ where: { subscriptionId: sub.id, periodStart: newPeriodStart } });
    expect(rows).toHaveLength(1);
    expect(rows[0].usedQty).toBe(0);
  });
});
