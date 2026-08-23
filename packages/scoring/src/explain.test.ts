import { describe, expect, it } from "vitest";
import { renderExplanation, starsForScore } from "./explain";
import { starsFor } from "./engine";
import type { ExplainPoint } from "./explain";

const battery: ExplainPoint = {
  code: "BATTERY_VOLTAGE",
  label: "Battery voltage",
  unit: "V",
  thresholds: { direction: "HIGHER_BETTER", good: 12.6, monitor: 12.4, attention: 12.0 },
  templates: {
    GOOD: "{component} is in good condition ({measured} {unit}). No action needed.",
    MONITOR: "{component} is serviceable, but {measured} {unit} is approaching the recommended limit of {threshold} {unit}. Have it monitored.",
    ATTENTION: "{component} needs attention soon ({measured} {unit}, below {threshold} {unit}).",
    CRITICAL: "{component} is in unsafe condition ({measured} {unit}).",
  },
};

describe("starsFor / starsForScore (FR-114, §11.5)", () => {
  it("maps every band boundary to the §11.5 star count", () => {
    const cases: Array<[number, 1 | 2 | 3 | 4 | 5]> = [
      [90, 5], [89, 4], [75, 4], [74, 3], [60, 3], [59, 2], [40, 2], [39, 1], [0, 1],
    ];
    for (const [score, stars] of cases) expect(starsForScore(score)).toBe(stars);
  });

  it("stars derive from the capped score — the worked example (69, FAIR) is 3 stars, not 4", () => {
    expect(starsForScore(69)).toBe(3);
    expect(starsFor("FAIR")).toBe(3);
  });
});

describe("renderExplanation (FR-115, §11.6a)", () => {
  it("substitutes measured/threshold/unit for the matched status", () => {
    const sentence = renderExplanation(battery, "MONITOR", { measuredValue: 12.4 });
    expect(sentence).toBe("Battery voltage is serviceable, but 12.4 V is approaching the recommended limit of 12.6 V. Have it monitored.");
  });

  it("oracle: 12.40 V at MONITOR names the component, its condition, and the monitoring advice", () => {
    const sentence = renderExplanation(battery, "MONITOR", { measuredValue: 12.4 })!;
    expect(sentence).toContain("Battery voltage");
    expect(sentence).toContain("12.4");
    expect(sentence.toLowerCase()).toContain("monitor");
  });

  it("NOT_APPLICABLE returns null — nothing to explain", () => {
    expect(renderExplanation(battery, "NOT_APPLICABLE", {})).toBeNull();
  });

  it("a point with no template for its status falls back to a generic sentence, never throws or renders empty", () => {
    const sparse: ExplainPoint = { code: "X", label: "Widget", templates: { GOOD: "all good" } };
    const sentence = renderExplanation(sparse, "ATTENTION", { measuredValue: 3, });
    expect(sentence).not.toBeNull();
    expect(sentence).not.toBe("");
    expect(sentence!.toLowerCase()).toContain("widget");
    expect(sentence!.toLowerCase()).toContain("attention");
  });

  it("unknown template placeholders resolve to empty (never leak braces)", () => {
    const weird: ExplainPoint = { code: "X", label: "Gizmo", templates: { GOOD: "{component} {mystery} is fine" } };
    expect(renderExplanation(weird, "GOOD", {})).toBe("Gizmo is fine");
  });

  it("generic fallback for a status-only point omits any measured clause", () => {
    const sparse: ExplainPoint = { code: "H", label: "Horn", templates: { GOOD: "ok" } };
    const sentence = renderExplanation(sparse, "MONITOR", {})!;
    expect(sentence.toLowerCase()).toContain("horn");
    expect(sentence).not.toContain("(");
  });

  it("generic fallback includes the measured value and unit when present", () => {
    const sparse: ExplainPoint = { code: "TP", label: "Tyre pressure", unit: "psi", templates: { GOOD: "ok" } };
    const sentence = renderExplanation(sparse, "CRITICAL", { measuredValue: 18 })!;
    expect(sentence).toContain("18 psi");
    expect(sentence.toLowerCase()).toContain("critical");
  });

  it("a measured point missing its thresholds leaves the threshold blank without error", () => {
    const noThresh: ExplainPoint = { code: "M", label: "Meter", unit: "V", templates: { MONITOR: "{component} near limit {threshold}" } };
    expect(renderExplanation(noThresh, "MONITOR", { measuredValue: 5 })).toBe("Meter near limit");
  });

  it("status-only points (no measured value) still render", () => {
    const statusPoint: ExplainPoint = {
      code: "DISC", label: "Brake discs",
      templates: { GOOD: "{component} is in good condition. No action needed." },
    };
    expect(renderExplanation(statusPoint, "GOOD", {})).toBe("Brake discs is in good condition. No action needed.");
  });

  it("threshold placeholder resolves to the boundary relevant to the status", () => {
    // ATTENTION boundary for HIGHER_BETTER is the `attention` threshold
    const sentence = renderExplanation(battery, "ATTENTION", { measuredValue: 11.8 })!;
    expect(sentence).toContain("12"); // attention threshold 12.0
  });
});
