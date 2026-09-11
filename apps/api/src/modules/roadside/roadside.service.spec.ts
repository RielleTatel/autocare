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

describe("RoadsideService.create (FR-031 → FR-034)", () => {
  const eligibleStub = () =>
    prismaStub({
      subscription: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 200 * DAY) }),
      },
      payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date(NOW.getTime() - 200 * DAY) }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: "veh-1" }) },
      roadsideRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          ...data,
          id: "rr-1",
          status: "REQUESTED",
          createdAt: NOW,
          address: data.address ?? null,
          landmarkNote: data.landmarkNote ?? null,
          responderName: null,
          etaMinutes: null,
          resolvedAt: null,
        })),
      },
    });

  const dto = {
    vehicleId: "veh-1",
    incidentType: "FLAT_TYRE" as const,
    lat: 6.9214,
    lng: 122.079,
    landmarkNote: "Beside the blue gate",
  };

  it("records a request for an eligible member", async () => {
    const svc = await build(eligibleStub());
    const r = await svc.create("user-1", dto);
    expect(r.id).toBe("rr-1");
    expect(r.status).toBe("REQUESTED");
  });

  it("refuses an ineligible member with ROADSIDE_NOT_ELIGIBLE", async () => {
    const svc = await build(prismaStub());
    await expect(svc.create("user-1", dto)).rejects.toMatchObject({ code: "ROADSIDE_NOT_ELIGIBLE", httpStatus: 403 });
  });

  it("refuses a vehicle the member does not own", async () => {
    const p = eligibleStub();
    (p as any).vehicle.findFirst = jest.fn().mockResolvedValue(null);
    const svc = await build(p);
    await expect(svc.create("user-1", dto)).rejects.toMatchObject({ code: "FORBIDDEN_ROLE" });
  });

  // A panicking member taps twice. The second tap must not open a second
  // incident for advisors to chase.
  it("returns the existing open request instead of opening a second one", async () => {
    const p = eligibleStub();
    const open = {
      id: "rr-existing",
      userId: "user-1",
      vehicleId: "veh-1",
      incidentType: "FLAT_TYRE",
      lat: 6.9,
      lng: 122.0,
      address: null,
      landmarkNote: null,
      status: "DISPATCHED",
      responderName: null,
      etaMinutes: null,
      createdAt: NOW,
      resolvedAt: null,
    };
    (p as any).roadsideRequest.findFirst = jest.fn().mockResolvedValue(open);
    const svc = await build(p);
    const r = await svc.create("user-1", dto);
    expect(r.id).toBe("rr-existing");
    expect((p as any).roadsideRequest.create).not.toHaveBeenCalled();
  });
});

describe("RoadsideService dispatch and status (FR-037 → FR-039)", () => {
  const advisor = { id: "adv-1", role: "ADVISOR" as const };
  const member = { id: "user-1", role: "MEMBER" as const };

  const withRequest = (status = "REQUESTED") =>
    prismaStub({
      roadsideRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: "rr-1", status }),
        findMany: jest.fn().mockResolvedValue([{ id: "rr-1", status }]),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          id: "rr-1",
          vehicleId: "veh-1",
          incidentType: "FLAT_TYRE",
          lat: 6.9,
          lng: 122.0,
          address: null,
          landmarkNote: null,
          responderName: null,
          etaMinutes: null,
          createdAt: NOW,
          resolvedAt: null,
          ...data,
        })),
      },
    });

  it("refuses a member trying to reach the dispatch board", async () => {
    const svc = await build(withRequest());
    await expect(svc.board(member)).rejects.toMatchObject({ code: "FORBIDDEN_ROLE", httpStatus: 403 });
  });

  it("lets an advisor assign a responder and moves the request to DISPATCHED", async () => {
    const svc = await build(withRequest("ACKNOWLEDGED"));
    const r = await svc.dispatch(advisor, "rr-1", { responderName: "J. Cruz", etaMinutes: 25 });
    expect(r.status).toBe("DISPATCHED");
    expect(r.responderName).toBe("J. Cruz");
    expect(r.etaMinutes).toBe(25);
  });

  it("walks the timeline forward", async () => {
    const svc = await build(withRequest("DISPATCHED"));
    const r = await svc.setStatus(advisor, "rr-1", { status: "EN_ROUTE" });
    expect(r.status).toBe("EN_ROUTE");
  });

  // The member watches this timeline. Letting it run backwards would tell
  // them a truck that had arrived is somehow on its way again.
  it("refuses a backwards transition", async () => {
    const svc = await build(withRequest("ON_SITE"));
    await expect(svc.setStatus(advisor, "rr-1", { status: "DISPATCHED" })).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("refuses any transition once resolved", async () => {
    const svc = await build(withRequest("RESOLVED"));
    await expect(svc.setStatus(advisor, "rr-1", { status: "EN_ROUTE" })).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("records the resolution and stamps resolvedAt", async () => {
    const svc = await build(withRequest("ON_SITE"));
    const r = await svc.resolve(advisor, "rr-1", { resolutionNotes: "Tyre changed on site", costCentavos: 45000 });
    expect(r.status).toBe("RESOLVED");
  });
});
