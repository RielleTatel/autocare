import { describe, it, expect } from "vitest";
import { DIAGRAM_ZONES } from "@autocare/contracts";
import { seedConfig } from "./seed-config";

const allPoints = seedConfig.categories.flatMap((c) => c.points);

// The four points whose position is genuinely ambiguous. Guessing a position for
// these would fabricate precision on a screen members use for safety decisions.
const INTENTIONALLY_UNMAPPED = [
  "BRAKE_DISC_CONDITION", "TYRE_PRESSURE_DEV", "WHEEL_CONDITION", "HORN",
];

describe("checklist point diagram zones", () => {
  it("covers all 50 points", () => {
    expect(allPoints).toHaveLength(50);
  });

  it("assigns only valid zones", () => {
    for (const p of allPoints) {
      if (p.diagramZone != null) {
        expect(DIAGRAM_ZONES).toContain(p.diagramZone);
      }
    }
  });

  it("leaves exactly the ambiguous points unmapped", () => {
    const unmapped = allPoints.filter((p) => p.diagramZone == null).map((p) => p.code).sort();
    expect(unmapped).toEqual([...INTENTIONALLY_UNMAPPED].sort());
  });

  it("gives each tyre tread point its own corner", () => {
    const byCode = Object.fromEntries(allPoints.map((p) => [p.code, p.diagramZone]));
    expect(byCode.TREAD_FL).toBe("WHEEL_FL");
    expect(byCode.TREAD_FR).toBe("WHEEL_FR");
    expect(byCode.TREAD_RL).toBe("WHEEL_RL");
    expect(byCode.TREAD_RR).toBe("WHEEL_RR");
  });

  it("maps brake pads per axle, not per corner", () => {
    const byCode = Object.fromEntries(allPoints.map((p) => [p.code, p.diagramZone]));
    expect(byCode.BRAKE_PAD_FRONT).toBe("AXLE_FRONT");
    expect(byCode.BRAKE_PAD_REAR).toBe("AXLE_REAR");
  });
});
