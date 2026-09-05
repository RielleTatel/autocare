import { DIAGRAM_ZONES } from "@autocare/contracts";
import { SHAPES, ZONE_SHAPES, shapeStatuses, zonesForShape } from "./diagramGeometry";

describe("diagram geometry", () => {
  it("gives every zone at least one shape", () => {
    for (const zone of DIAGRAM_ZONES) {
      expect(ZONE_SHAPES[zone].length).toBeGreaterThan(0);
    }
  });

  it("only references shapes that exist", () => {
    const ids = new Set(SHAPES.map((s) => s.id));
    for (const zone of DIAGRAM_ZONES) {
      for (const shapeId of ZONE_SHAPES[zone]) {
        expect(ids.has(shapeId)).toBe(true);
      }
    }
  });

  it("gives every shape non-empty path data", () => {
    for (const s of SHAPES) {
      expect(s.d.length).toBeGreaterThan(0);
      expect(s.d.trim().startsWith("M")).toBe(true);
    }
  });

  it("spreads axle zones across both wheels on that axle", () => {
    expect([...ZONE_SHAPES.AXLE_FRONT].sort()).toEqual(["WHEEL_FL", "WHEEL_FR"]);
    expect([...ZONE_SHAPES.AXLE_REAR].sort()).toEqual(["WHEEL_RL", "WHEEL_RR"]);
    expect(ZONE_SHAPES.CORNERS_ALL).toHaveLength(4);
  });

  it("gives a shape the worst status across every zone touching it", () => {
    // A front wheel belongs to WHEEL_FL, AXLE_FRONT and CORNERS_ALL.
    const out = shapeStatuses({ WHEEL_FL: "GOOD", AXLE_FRONT: "CRITICAL" });
    expect(out.WHEEL_FL).toBe("CRITICAL");
    expect(out.WHEEL_FR).toBe("CRITICAL"); // also on the front axle
    expect(out.WHEEL_RL).toBeUndefined();
  });

  it("reports every zone covering a shape", () => {
    expect(zonesForShape("WHEEL_FL").sort()).toEqual(["AXLE_FRONT", "CORNERS_ALL", "WHEEL_FL"]);
  });

  it("returns an empty map when nothing is scored", () => {
    expect(shapeStatuses({})).toEqual({});
  });
});
