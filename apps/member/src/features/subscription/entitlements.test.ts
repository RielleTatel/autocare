import { entitlementLabel, entitlementFraction, lockInDaysRemaining, statusMessage } from "./entitlements";
import { EntitlementSummary } from "@autocare/contracts";

const e = (over: Partial<EntitlementSummary> = {}): EntitlementSummary => ({
  entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 1, remaining: 1, ...over,
});

describe("entitlementLabel", () => {
  it("renders remaining of quota with a friendly noun", () => {
    expect(entitlementLabel(e())).toBe("1 of 2 inspections left");
  });
  it("falls back to a lowercased type for unknown entitlements", () => {
    expect(entitlementLabel(e({ entitlementType: "CAR_WASH", quantityPerCycle: 3, remaining: 3 }))).toBe("3 of 3 car wash left");
  });
});

describe("entitlementFraction", () => {
  it("computes remaining/quota", () => {
    expect(entitlementFraction(e({ quantityPerCycle: 4, remaining: 1 }))).toBe(0.25);
  });
  it("is 0 for a zero-quota entitlement (no divide-by-zero)", () => {
    expect(entitlementFraction(e({ quantityPerCycle: 0, remaining: 0 }))).toBe(0);
  });
  it("clamps to [0, 1]", () => {
    expect(entitlementFraction(e({ quantityPerCycle: 2, remaining: 5 }))).toBe(1);
  });
});

describe("lockInDaysRemaining", () => {
  it("counts whole days remaining", () => {
    const now = new Date("2026-08-22T00:00:00Z");
    expect(lockInDaysRemaining("2026-09-01T00:00:00Z", now)).toBe(10);
  });
  it("never goes negative once lock-in has passed", () => {
    const now = new Date("2026-08-22T00:00:00Z");
    expect(lockInDaysRemaining("2026-01-01T00:00:00Z", now)).toBe(0);
  });
});

describe("statusMessage", () => {
  it("has a message for every subscription status", () => {
    for (const s of ["ACTIVE", "GRACE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const) {
      expect(statusMessage(s).length).toBeGreaterThan(0);
    }
  });
});
