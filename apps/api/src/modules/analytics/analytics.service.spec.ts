import { AnalyticsService } from "./analytics.service";
import { DomainError } from "../../common/errors/domain-error";

const NOW = new Date("2026-08-28T00:00:00.000Z");
const clock = { now: () => NOW };

const admin = { id: "u-admin", role: "ADMIN" } as never;
const advisor = { id: "u-adv", role: "ADVISOR" } as never;

function makePrisma() {
  return {
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { userId: "u1", plan: { priceCentavos: 149900n, billingInterval: "MONTHLY" } },
        { userId: "u1", plan: { priceCentavos: 149900n, billingInterval: "MONTHLY" } },
        { userId: "u2", plan: { priceCentavos: 450000n, billingInterval: "QUARTERLY" } },
      ]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as never;
}

const utilisation = { forWindow: jest.fn().mockResolvedValue([{ ratio: 0.6 }, { ratio: 0.9 }]) } as never;

type PrismaStub = { subscription: { findMany: jest.Mock; count: jest.Mock } };

describe("AnalyticsService.summary", () => {
  it("refuses non-admins", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    await expect(svc.summary(advisor)).rejects.toThrow(DomainError);
  });

  it("sums MRR on a monthly basis and counts distinct members", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    const out = await svc.summary(admin);
    // 149900 + 149900 + (450000/3 = 150000)
    expect(out.mrrCentavos).toBe("449800");
    // u1 holds two subscriptions but is one member
    expect(out.activeMembers).toBe(2);
  });

  it("reports churn over the population contracted when the window opened", async () => {
    const prisma = makePrisma();
    // Call order: cancelled-in-window, then contracted-now. The denominator is
    // the opening population, i.e. those still contracted plus those who left.
    (prisma as unknown as PrismaStub).subscription.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(147);
    const svc = new AnalyticsService(prisma, utilisation, clock);
    const out = await svc.summary(admin);
    expect(out.churn30d).toBeCloseTo(0.02, 5);
  });

  it("reports mean forward bay utilisation", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    const out = await svc.summary(admin);
    expect(out.bayUtilisation).toBeCloseTo(0.75, 5);
  });

  it("does not blow up on an empty book", async () => {
    const prisma = makePrisma();
    (prisma as unknown as PrismaStub).subscription.findMany.mockResolvedValue([]);
    const empty = { forWindow: jest.fn().mockResolvedValue([]) } as never;
    const svc = new AnalyticsService(prisma, empty, clock);
    const out = await svc.summary(admin);
    expect(out).toEqual({ mrrCentavos: "0", activeMembers: 0, churn30d: 0, bayUtilisation: 0 });
  });
});
