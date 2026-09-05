import { describe, it, expect } from "vitest";
import { diagramZoneSchema, DIAGRAM_ZONES } from "./diagram";

describe("diagramZoneSchema", () => {
  it("accepts every declared zone", () => {
    for (const zone of DIAGRAM_ZONES) {
      expect(diagramZoneSchema.parse(zone)).toBe(zone);
    }
  });

  it("rejects an unknown zone", () => {
    expect(() => diagramZoneSchema.parse("BOOT_LID")).toThrow();
  });

  it("declares exactly the fourteen zones the diagram can draw", () => {
    expect(DIAGRAM_ZONES).toHaveLength(14);
    expect([...DIAGRAM_ZONES].sort()).toEqual([
      "AXLE_FRONT", "AXLE_REAR", "BODY_SHELL", "CABIN", "CORNERS_ALL",
      "ENGINE_BAY", "LIGHTS_ALL", "LIGHTS_FRONT", "LIGHTS_REAR",
      "UNDERBODY", "WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR",
    ].sort());
  });
});
