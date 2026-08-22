import { selectManageableSubscription } from "./subscriptionSelection";
import { subscriptionStatuses } from "@autocare/contracts";

type Sub = { vehicleId: string; status: (typeof subscriptionStatuses)[number]; startedAt: string };

const sub = (over: Partial<Sub> = {}): Sub => ({
  vehicleId: "v1", status: "ACTIVE", startedAt: "2026-08-01T00:00:00Z", ...over,
});

describe("selectManageableSubscription", () => {
  it("picks the single non-cancelled subscription for the vehicle", () => {
    const subs = [sub({ vehicleId: "v1", status: "ACTIVE" })];
    expect(selectManageableSubscription(subs, "v1")).toBe(subs[0]);
  });

  it("prefers ACTIVE when a CANCELLED and an ACTIVE subscription both exist for the vehicle", () => {
    const cancelled = sub({ vehicleId: "v1", status: "CANCELLED", startedAt: "2026-01-01T00:00:00Z" });
    const active = sub({ vehicleId: "v1", status: "ACTIVE", startedAt: "2025-01-01T00:00:00Z" });
    expect(selectManageableSubscription([cancelled, active], "v1")).toBe(active);
  });

  it("returns null when the vehicle has no non-cancelled subscription", () => {
    const subs = [sub({ vehicleId: "v1", status: "CANCELLED" })];
    expect(selectManageableSubscription(subs, "v1")).toBeNull();
  });

  it("returns null when the vehicle has no subscriptions at all", () => {
    expect(selectManageableSubscription([], "v1")).toBeNull();
  });

  it("does not pick a different vehicle's subscription (multi-vehicle misroute case)", () => {
    const otherVehicleSub = sub({ vehicleId: "v2", status: "ACTIVE" });
    expect(selectManageableSubscription([otherVehicleSub], "v1")).toBeNull();
  });

  it("picks the most recently started when multiple non-cancelled, non-ACTIVE subscriptions exist for the vehicle", () => {
    const older = sub({ vehicleId: "v1", status: "PAST_DUE", startedAt: "2026-01-01T00:00:00Z" });
    const newer = sub({ vehicleId: "v1", status: "GRACE", startedAt: "2026-06-01T00:00:00Z" });
    expect(selectManageableSubscription([older, newer], "v1")).toBe(newer);
  });
});
