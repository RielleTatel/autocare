import { describe, expect, it } from "vitest";
import { computeVHS, deriveStatus } from "./engine";
import type { ChecklistConfig, ConfigPoint, Thresholds } from "./types";

/** Categories tuned so sub-scores match §11.4 exactly. Weights are the REBALANCED
 *  10-category set (§11.3 Step 4, revised 2026-08-17) — Emissions and Sensors added,
 *  everything else scaled down to keep the total at 100.
 *  Condition factors implied by these fixtures: GOOD 100, MONITOR 75, ATTENTION 40.
 *  ENGINE 92 (w68 GOOD + w32 MONITOR), BRAKES 75.8 (the doc's 5 points),
 *  TYRES 70 (w50 GOOD + w50 ATTENTION), BATTERY 100, FLUIDS 85 (w75 GOOD + w25 ATTENTION),
 *  SUSPENSION 90 (w60 GOOD + w40 MONITOR), LIGHTS 75 (single MONITOR),
 *  EMISSIONS 88 (w52 GOOD + w48 MONITOR), SENSORS 82 (w28 GOOD + w72 MONITOR),
 *  BODY 95 (w80 GOOD + w20 MONITOR). */
export const workedExampleConfig: ChecklistConfig = {
  checklistVersion: "test-v1", weightVersion: "test-w1",
  categories: [
    { code: "ENGINE", label: "Engine & Drivetrain", weight: 18, points: [
      p("ENG_A", 68), p("ENG_B", 32)] },
    { code: "BRAKES", label: "Brakes", weight: 16, points: [
      m("BRAKE_PAD_FRONT", 30, true, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }),
      m("BRAKE_PAD_REAR", 25, true, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }),
      m("BRAKE_FLUID", 20, true, { direction: "LOWER_BETTER", good: 2, monitor: 3, attention: 4 }),
      p("BRAKE_DISC", 15, true), p("PARKING_BRAKE", 10, true)] },
    { code: "TYRES", label: "Tyres & Wheels", weight: 14, points: [p("TY_A", 50), p("TY_B", 50)] },
    { code: "BATTERY", label: "Battery & Electrical", weight: 11, points: [p("BAT_A", 100)] },
    { code: "FLUIDS", label: "Fluids", weight: 11, points: [p("FL_A", 75), p("FL_B", 25)] },
    { code: "SUSP", label: "Suspension & Steering", weight: 9, points: [p("SU_A", 60), p("SU_B", 40)] },
    { code: "LIGHTS", label: "Lights & Visibility", weight: 7, points: [p("LI_A", 100)] },
    { code: "EMISSIONS", label: "Emissions Systems", weight: 5, points: [p("EM_A", 52), p("EM_B", 48)] },
    { code: "SENSORS", label: "Sensors & Electronics", weight: 5, points: [
      p("SEN_AIRBAG", 28, true), p("SEN_B", 72)] },
    { code: "BODY", label: "Body & Undercarriage", weight: 4, points: [p("BO_A", 80), p("BO_B", 20)] },
  ],
};
function p(code: string, w: number, sc = false): ConfigPoint {
  return { code, label: code, weightInCategory: w, isSafetyCritical: sc, inputType: "STATUS" as const, recommendation: `Fix ${code}` };
}
function m(code: string, w: number, sc: boolean, thresholds: Thresholds): ConfigPoint {
  return { code, label: code, weightInCategory: w, isSafetyCritical: sc, inputType: "MEASURED" as const, thresholds, recommendation: `Fix ${code}` };
}

const workedResults = [
  { pointCode: "ENG_A", status: "GOOD" }, { pointCode: "ENG_B", status: "MONITOR" },
  { pointCode: "BRAKE_PAD_FRONT", measuredValue: 3.0 },   // → ATTENTION (safety-critical)
  { pointCode: "BRAKE_PAD_REAR", measuredValue: 6.0 },    // → MONITOR
  { pointCode: "BRAKE_FLUID", measuredValue: 1.4 },       // → GOOD
  { pointCode: "BRAKE_DISC", status: "GOOD" }, { pointCode: "PARKING_BRAKE", status: "GOOD" },
  { pointCode: "TY_A", status: "GOOD" }, { pointCode: "TY_B", status: "ATTENTION" },
  { pointCode: "BAT_A", status: "GOOD" },
  { pointCode: "FL_A", status: "GOOD" }, { pointCode: "FL_B", status: "ATTENTION" },
  { pointCode: "SU_A", status: "GOOD" }, { pointCode: "SU_B", status: "MONITOR" },
  { pointCode: "LI_A", status: "MONITOR" },
  { pointCode: "EM_A", status: "GOOD" }, { pointCode: "EM_B", status: "MONITOR" },
  { pointCode: "SEN_AIRBAG", status: "GOOD" }, { pointCode: "SEN_B", status: "MONITOR" },
  { pointCode: "BO_A", status: "GOOD" }, { pointCode: "BO_B", status: "MONITOR" },
] as const;

describe("worked example (VHS doc §11.4)", () => {
  const result = () => computeVHS({ results: [...workedResults], daysSinceInspection: 0 }, workedExampleConfig);
  it("derives measured statuses from thresholds", () => {
    expect(deriveStatus(3.0, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 })).toBe("ATTENTION");
    expect(deriveStatus(6.0, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 })).toBe("MONITOR");
    expect(deriveStatus(1.4, { direction: "LOWER_BETTER", good: 2, monitor: 3, attention: 4 })).toBe("GOOD");
  });
  it("computes brakes sub-score 75.8", () => {
    expect(result().categoryScores.find(c => c.categoryCode === "BRAKES")!.score).toBe(75.8);
  });
  it("computes rawScore 84.488", () => { expect(result().rawScore).toBe(84.488); });
  it("caps at 69 via SAFETY_ATTENTION override", () => {
    expect(result().score).toBe(69);
    expect(result().overrideApplied).toBe("SAFETY_ATTENTION");
    expect(result().band).toBe("FAIR");
  });
  it("ranks front brake pads as top detractor", () => {
    expect(result().topDetractors[0].pointCode).toBe("BRAKE_PAD_FRONT");
    expect(result().topDetractors).toHaveLength(3);
  });
  it("reports HIGH confidence for a complete, fresh inspection", () => {
    expect(result().confidence).toBe("HIGH");
  });
});
