import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK } from "../../common/clock/clock";
import { RoadsideService, ROADSIDE_WAITING_DAYS } from "./roadside.service";

const DAY = 86_400_000;
const NOW = new Date("2026-06-01T00:00:00Z");

/** Minimal Prisma stand-in: only the reads `eligibility` performs. */
function prismaStub(over: Partial<Record<string, any>> = {}) {
  return {
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: { findFirst: jest.fn().mockResolvedValue(null) },
    ...over,
  } as unknown as PrismaService;
}

async function build(prisma: PrismaService) {
  const mod = await Test.createTestingModule({
    providers: [
      RoadsideService,
      { provide: PrismaService, useValue: prisma },
      { provide: CLOCK, useValue: { now: () => NOW } },
    ],
  }).compile();
  return mod.get(RoadsideService);
}

describe("RoadsideService.eligibility (BR-02, FR-034/FR-035)", () => {
  it("refuses a member with no active subscription, and says what to do instead", async () => {
    const svc = await build(prismaStub());
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/subscription/i);
  });

  it("refuses when no payment has cleared yet", async () => {
    const svc = await build(
      prismaStub({
        subscription: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 90 * DAY) }),
        },
      }),
    );
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/payment/i);
  });

  // The rule is measured from the cleared payment, NOT from signup — a member
  // who subscribed months ago but only just paid is still inside the window.
  it("refuses while inside the waiting period, and names the date it opens", async () => {
    const paidAt = new Date(NOW.getTime() - 10 * DAY);
    const svc = await build(
      prismaStub({
        subscription: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 200 * DAY) }),
        },
        payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
      }),
    );
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.eligibleFrom).toBe(new Date(paidAt.getTime() + ROADSIDE_WAITING_DAYS * DAY).toISOString());
  });

  it("allows once the waiting period has elapsed", async () => {
    const paidAt = new Date(NOW.getTime() - (ROADSIDE_WAITING_DAYS + 1) * DAY);
    const svc = await build(
      prismaStub({
        subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: paidAt }) },
        payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
      }),
    );
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("treats the boundary day as eligible", async () => {
    const paidAt = new Date(NOW.getTime() - ROADSIDE_WAITING_DAYS * DAY);
    const svc = await build(
      prismaStub({
        subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: paidAt }) },
        payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
      }),
    );
    expect((await svc.eligibility("user-1")).eligible).toBe(true);
  });

  it("refuses a suspended subscription even after the waiting period", async () => {
    const paidAt = new Date(NOW.getTime() - 200 * DAY);
    const svc = await build(
      prismaStub({
        subscription: { findFirst: jest.fn().mockResolvedValue(null) }, // findFirst filters on status
        payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
      }),
    );
    expect((await svc.eligibility("user-1")).eligible).toBe(false);
  });
});
