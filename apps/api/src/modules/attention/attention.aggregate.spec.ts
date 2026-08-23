import { aggregateAttention, AttentionInputs } from "./attention.aggregate";

const now = new Date("2026-08-24T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

function inputs(over: Partial<AttentionInputs> = {}): AttentionInputs {
  return {
    componentFindings: [],
    recommendations: [],
    entitlementsExpiring: [],
    servicesDue: [],
    plates: new Map([["v1", "ABC-1234"], ["v2", "XYZ-9876"]]),
    multiVehicle: true,
    ...over,
  };
}

const fullFixture = () =>
  inputs({
    componentFindings: [
      { vehicleId: "v1", categoryCode: "BRAKES", pointCode: "BRAKE_PAD_FRONT", label: "Front brake pads", severity: "CRITICAL", inspectionId: "insp1", createdAt: daysAgo(1) },
    ],
    recommendations: [
      { id: "r1", vehicleId: "v1", label: "Front brake pads", recommendation: "Replace soon", severity: "ATTENTION", createdAt: daysAgo(1) },
      { id: "r2", vehicleId: "v2", label: "Wipers", recommendation: "Replace blades", severity: "MONITOR", createdAt: daysAgo(3) },
    ],
    entitlementsExpiring: [
      { vehicleId: "v1", subscriptionId: "s1", entitlementType: "OIL_CHANGE", remaining: 1, daysToExpiry: 5, periodEnd: daysAgo(-5) },
    ],
    servicesDue: [
      { vehicleId: "v2", serviceTypeId: "st1", serviceTypeName: "Oil change", dueDate: daysAgo(2), overdue: true },
    ],
  });

describe("aggregateAttention", () => {
  it("surfaces all five feeds", () => {
    const items = aggregateAttention(fullFixture());
    expect(items).toHaveLength(5);
    expect(new Set(items.map((i) => i.kind))).toEqual(new Set(["COMPONENT_STATUS", "RECOMMENDATION", "ENTITLEMENT_EXPIRING", "SERVICE_DUE"]));
  });

  it("sorts CRITICAL first, then by recency", () => {
    const items = aggregateAttention(fullFixture());
    expect(items[0].severity).toBe("CRITICAL");
    // remaining order is by severity rank then recency
    const ranks = items.map((i) => ["CRITICAL", "ATTENTION", "MONITOR", "INFO"].indexOf(i.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("labels each item with its vehicle plate when the member has >1 vehicle", () => {
    const items = aggregateAttention(fullFixture());
    expect(items.every((i) => i.plate !== undefined)).toBe(true);
    expect(items.find((i) => i.vehicleId === "v2")!.plate).toBe("XYZ-9876");
  });

  it("omits the plate chip for a single-vehicle member (FR-110)", () => {
    const single = inputs({
      multiVehicle: false,
      recommendations: [{ id: "r1", vehicleId: "v1", label: "Pads", recommendation: "x", severity: "ATTENTION", createdAt: now }],
    });
    const items = aggregateAttention(single);
    expect(items[0].plate).toBeUndefined();
  });

  it("returns [] for a member with nothing outstanding (empty is a real state, FR-113)", () => {
    expect(aggregateAttention(inputs())).toEqual([]);
  });

  it("gives every item a one-tap deep link with the right screen + params", () => {
    const items = aggregateAttention(fullFixture());
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.deepLink]));
    expect(byKind.COMPONENT_STATUS).toEqual({ screen: "CategoryBreakdown", params: { vehicleId: "v1", category: "BRAKES" } });
    expect(byKind.RECOMMENDATION.screen).toBe("Recommendations");
    expect(byKind.SERVICE_DUE.screen).toBe("Booking");
    expect(byKind.ENTITLEMENT_EXPIRING.screen).toBe("SubscriptionDashboard");
  });
});
