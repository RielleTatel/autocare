import { InspectionsService } from "./inspections.service";

describe("InspectionsService.markStale (BR-05)", () => {
  const updateMany = jest.fn().mockResolvedValue({ count: 2 });
  const service = new InspectionsService({ healthScore: { updateMany } } as any);

  beforeEach(() => updateMany.mockClear());

  it("flips isStale only for scores older than 90 days, never touching values", async () => {
    const now = new Date("2026-08-24T05:00:00+08:00");
    const count = await service.markStale(now);
    expect(count).toBe(2);
    const args = updateMany.mock.calls[0][0];
    expect(args.data).toEqual({ isStale: true }); // the ONLY mutated field
    expect(args.where.isStale).toBe(false);
    const cutoff: Date = args.where.computedAt.lt;
    // day-90/91 boundary: a score computed exactly 90 days ago is NOT yet stale
    // (strict <), one computed 90 days + 1ms ago is.
    const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBe(day90.getTime());
  });
});

describe("InspectionsService.inspectionDetail — diagram zones (FR-116)", () => {
  const point = (code: string, diagramZoneId: string | null) => ({
    pointCode: code,
    status: "GOOD",
    measuredValue: null,
    notes: null,
    photoUrls: [],
    point: {
      label: code,
      labelFil: null,
      categoryId: "cat-1",
      category: { code: "TYRES" },
      unit: null,
      thresholdDirection: null,
      templates: null,
      recommendation: "",
      isSafetyCritical: false,
      diagramZoneId,
    },
  });

  const findFirst = jest.fn().mockResolvedValue({
    id: "insp-1",
    submittedAt: null,
    odometerKm: null,
    results: [point("TREAD_FL", "WHEEL_FL"), point("WHEEL_CONDITION", null)],
  });
  // A staff role short-circuits assertCanReadVehicle, so no vehicle mock is needed.
  const service = new InspectionsService({ inspection: { findFirst } } as any);
  const staff = { id: "u1", role: "ADMIN" } as any;

  it("returns the zone for a point whose position is known", async () => {
    const detail = await service.inspectionDetail(staff, "veh-1", "insp-1");
    expect(detail.results.find((r) => r.pointCode === "TREAD_FL")?.diagramZone).toBe("WHEEL_FL");
  });

  it("returns null for a point with no unambiguous position", async () => {
    const detail = await service.inspectionDetail(staff, "veh-1", "insp-1");
    expect(detail.results.find((r) => r.pointCode === "WHEEL_CONDITION")?.diagramZone).toBeNull();
  });
});
