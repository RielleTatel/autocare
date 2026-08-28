import { zoneStatuses, worstStatus } from "./zoneStatus";

const r = (diagramZone: any, status: any) => ({ diagramZone, status });

describe("worstStatus", () => {
  it("ranks CRITICAL above ATTENTION above MONITOR above GOOD", () => {
    expect(worstStatus("GOOD", "MONITOR")).toBe("MONITOR");
    expect(worstStatus("MONITOR", "ATTENTION")).toBe("ATTENTION");
    expect(worstStatus("ATTENTION", "CRITICAL")).toBe("CRITICAL");
  });

  it("returns whichever side is defined when the other is missing", () => {
    expect(worstStatus(undefined, "GOOD")).toBe("GOOD");
    expect(worstStatus("ATTENTION", undefined)).toBe("ATTENTION");
    expect(worstStatus(undefined, undefined)).toBeUndefined();
  });
});

describe("zoneStatuses", () => {
  it("keeps the worst status per zone", () => {
    const out = zoneStatuses([
      r("ENGINE_BAY", "GOOD"),
      r("ENGINE_BAY", "CRITICAL"),
      r("ENGINE_BAY", "MONITOR"),
    ]);
    expect(out.ENGINE_BAY).toBe("CRITICAL");
  });

  it("keeps zones independent", () => {
    const out = zoneStatuses([r("WHEEL_FL", "CRITICAL"), r("WHEEL_FR", "GOOD")]);
    expect(out.WHEEL_FL).toBe("CRITICAL");
    expect(out.WHEEL_FR).toBe("GOOD");
  });

  it("ignores points with no zone", () => {
    const out = zoneStatuses([r(null, "CRITICAL")]);
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("excludes NOT_APPLICABLE, matching the scoring engine", () => {
    const out = zoneStatuses([r("CABIN", "NOT_APPLICABLE")]);
    expect(out.CABIN).toBeUndefined();
  });

  it("ignores a result whose status has not been recorded", () => {
    const out = zoneStatuses([r("CABIN", null)]);
    expect(out.CABIN).toBeUndefined();
  });

  it("ignores an unknown zone from a newer checklist without throwing", () => {
    expect(() => zoneStatuses([r("BOOT_LID", "CRITICAL")])).not.toThrow();
    expect(zoneStatuses([r("BOOT_LID", "CRITICAL")])).toEqual({});
  });

  it("returns an empty map for no results", () => {
    expect(zoneStatuses([])).toEqual({});
  });
});
