import { AttentionService } from "./attention.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AnnouncementsService } from "../announcements/announcements.service";

/**
 * The fan-out guard.
 *
 * `componentFindings` used to loop per vehicle, and each pass carried a
 * four-level nested include. On localhost that was invisible — a round trip
 * costs ~0.1ms. Against a hosted database ~80ms away it put /me/attention at
 * 3.2s against a 500ms NFR-002 target.
 *
 * So this asserts the shape that matters: the number of database calls must not
 * grow with the number of vehicles.
 */
describe("AttentionService — query fan-out", () => {
  function prismaSpy(vehicleCount: number) {
    const vehicles = Array.from({ length: vehicleCount }, (_, i) => ({ id: `veh-${i}`, plateNo: `ABC${i}` }));
    const calls: string[] = [];
    const track = <T>(name: string, value: T) => {
      calls.push(name);
      return Promise.resolve(value);
    };
    const prisma = {
      vehicle: { findMany: () => track("vehicle.findMany", vehicles) },
      healthScore: {
        findFirst: () => track("healthScore.findFirst", null),
        findMany: () =>
          track(
            "healthScore.findMany",
            vehicles.map((v, i) => ({ vehicleId: v.id, inspectionId: `insp-${i}`, computedAt: new Date() })),
          ),
      },
      inspectionResult: { findMany: () => track("inspectionResult.findMany", []) },
      recommendation: { findMany: () => track("recommendation.findMany", []) },
      subscription: { findMany: () => track("subscription.findMany", []) },
    } as unknown as PrismaService;
    const announcements = { activeServiceDue: async () => [] } as unknown as AnnouncementsService;
    return { svc: new AttentionService(prisma, announcements), calls };
  }

  it("does not issue more queries for more vehicles", async () => {
    const one = prismaSpy(1);
    await one.svc.build("member-1");
    const many = prismaSpy(8);
    await many.svc.build("member-1");
    expect(many.calls.length).toBe(one.calls.length);
  });

  it("never calls healthScore per vehicle", async () => {
    const { svc, calls } = prismaSpy(8);
    await svc.build("member-1");
    expect(calls.filter((c) => c === "healthScore.findFirst")).toHaveLength(0);
    expect(calls.filter((c) => c === "healthScore.findMany")).toHaveLength(1);
  });

  // Five feeds, one query each, is the floor this endpoint can reach.
  it("stays within a small fixed budget of queries", async () => {
    const { svc, calls } = prismaSpy(8);
    await svc.build("member-1");
    expect(calls.length).toBeLessThanOrEqual(6);
  });
});
