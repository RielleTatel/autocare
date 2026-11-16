import { SubscriptionsService } from "./subscriptions.service";
import { MEMBER_CHECKOUT_ORIGIN } from "../payments/checkout-policy";

const now = new Date("2026-11-16T06:00:00Z");
const user = { id: "user-1", role: "MEMBER" as const };
function setup() {
  const basic = { id: "basic", name: "Basic", code: "BASIC", priceCentavos: 100000n, billingInterval: "MONTHLY", lockInMonths: 12, isActive: true };
  const premium = { ...basic, id: "premium", name: "Premium", priceCentavos: 200000n };
  const subscription = {
    id: "sub-1", vehicleId: "vehicle-1", planId: "basic", userId: "user-1", status: "ACTIVE", paymentMethod: "E_PAYMENT",
    startedAt: now, lockInEndsAt: now, currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-12-01T00:00:00Z"), cancelRequestedAt: null, pendingPlanId: null, plan: basic,
  };
  const tx = {
    subscription: {
      create: jest.fn(async () => subscription),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(async () => ({ ...subscription, planId: "premium" })),
      update: jest.fn(async () => ({ ...subscription, pendingPlanId: "basic" })),
    },
    invoice: { count: jest.fn().mockResolvedValue(3), create: jest.fn().mockResolvedValue({ id: "exact-invoice" }) },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    plan: { findUnique: jest.fn(async ({ where }) => where.id === "basic" ? basic : premium), findMany: jest.fn(async () => [basic]) },
    subscription: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn(async () => subscription), findMany: jest.fn(async () => [subscription]), update: tx.subscription.update },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  const vehicles = { findForUser: jest.fn() };
  const service = new SubscriptionsService(prisma as never, vehicles as never);
  return { service, tx, prisma, vehicles, subscription, basic, premium };
}

describe("Subscription checkout operations", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => jest.useRealTimers());

  it("returns the exact initial invoice created with the subscription and durable supported origin", async () => {
    const { service, tx } = setup();
    const result = await service.create(user, { vehicleId: "vehicle-1", planId: "basic", paymentMethod: "E_PAYMENT" });
    expect(result).toMatchObject({ id: "sub-1", invoiceId: "exact-invoice", status: "ACTIVE" });
    expect(tx.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ subscriptionId: "sub-1", totalCentavos: 100000n, status: "AWAITING_AUTO_CHARGE" }) });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: MEMBER_CHECKOUT_ORIGIN, entityId: "exact-invoice", after: { kind: "INITIAL_SUBSCRIPTION", subscriptionId: "sub-1", planId: "basic" } }) });
  });

  it("returns the upgrade invoice directly and clears a superseded pending downgrade", async () => {
    const { service, tx } = setup();
    const result = await service.upgrade(user, "sub-1", { planId: "premium" });
    expect(result).toMatchObject({ planId: "premium", invoiceId: "exact-invoice", proratedChargeCentavos: 50000 });
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({ where: { id: "sub-1", planId: "basic", status: "ACTIVE" }, data: { planId: "premium", pendingPlanId: null } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ after: { kind: "UPGRADE", subscriptionId: "sub-1", planId: "premium" } }) });
  });

  it("rejects a lost upgrade race without creating another invoice", async () => {
    const { service, tx } = setup();
    tx.subscription.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.upgrade(user, "sub-1", { planId: "premium" })).rejects.toMatchObject({ code: "SUBSCRIPTION_NOT_UPGRADE", httpStatus: 409 });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("keeps initial creation behind ownership, existing-active and available-plan checks", async () => {
    const { service, prisma, tx, vehicles } = setup();
    prisma.subscription.findFirst.mockResolvedValue({ id: "existing" } as never);
    await expect(service.create(user, { vehicleId: "vehicle-1", planId: "basic", paymentMethod: "E_PAYMENT" })).rejects.toMatchObject({ code: "SUBSCRIPTION_ALREADY_ACTIVE" });
    expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "update");
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("returns the named pending plan on get and list without charging for a downgrade", async () => {
    const { service, subscription, basic, premium, tx } = setup();
    Object.assign(subscription, { planId: "premium", plan: premium, pendingPlanId: "basic" });
    await expect(service.get(user, "sub-1")).resolves.toMatchObject({ pendingPlan: { id: "basic", name: "Basic" } });
    await expect(service.list(user)).resolves.toMatchObject([{ pendingPlan: { id: "basic", name: "Basic" } }]);
    const result = await service.downgrade(user, "sub-1", { planId: "basic" });
    expect(result).toMatchObject({ pendingPlanId: basic.id, effectiveAt: "2026-12-01T00:00:00.000Z" });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
