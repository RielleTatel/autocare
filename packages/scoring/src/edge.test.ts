import { describe, expect, it } from "vitest";
import { bandForScore, computeVHS, starsFor } from "./engine";
import { seedConfig } from "./seed-config";
import type { Band, ChecklistConfig } from "./types";

const oneStatusCat = (points: Array<{ code: string; w: number; sc?: boolean }>): ChecklistConfig => ({
  checklistVersion: "edge-v1", weightVersion: "edge-w1",
  categories: [{ code: "C1", label: "C1", weight: 100, points: points.map(x => ({
    code: x.code, label: x.code, weightInCategory: x.w, isSafetyCritical: x.sc ?? false,
    inputType: "STATUS" as const, recommendation: `Fix ${x.code}`,
  })) }],
});

describe("edge cases", () => {
  it("empty results → score 0, LOW confidence", () => {
    const out = computeVHS({ results: [], daysSinceInspection: 0 }, seedConfig);
    expect(out.score).toBe(0);
    expect(out.rawScore).toBe(0);
    expect(out.band).toBe("CRITICAL");
    expect(out.confidence).toBe("LOW");
    expect(out.topDetractors).toEqual([]);
  });

  it("empty config (no categories) → score 0, no NaN", () => {
    const out = computeVHS({ results: [], daysSinceInspection: 0 }, { checklistVersion: "x", weightVersion: "x", categories: [] });
    expect(out.score).toBe(0);
    expect(Number.isNaN(out.rawScore)).toBe(false);
  });

  it("unknown pointCode in results is ignored", () => {
    const cfg = oneStatusCat([{ code: "P1", w: 100 }]);
    const out = computeVHS({ results: [{ pointCode: "P1", status: "GOOD" }, { pointCode: "GHOST", status: "CRITICAL" }], daysSinceInspection: 0 }, cfg);
    expect(out.score).toBe(100);
  });

  it("category whose only answered points have zero weight → sub-score 0, no NaN", () => {
    const cfg = oneStatusCat([{ code: "Z1", w: 0 }, { code: "Z2", w: 0 }]);
    const out = computeVHS({ results: [{ pointCode: "Z1", status: "GOOD" }, { pointCode: "Z2", status: "GOOD" }], daysSinceInspection: 0 }, cfg);
    expect(Number.isNaN(out.rawScore)).toBe(false);
    expect(out.categoryScores[0].score).toBe(0);
  });

  it("SAFETY_CRITICAL with raw already below the cap leaves the score alone", () => {
    const cfg = oneStatusCat([{ code: "S1", w: 100, sc: true }]);
    const out = computeVHS({ results: [{ pointCode: "S1", status: "CRITICAL" }], daysSinceInspection: 0 }, cfg);
    expect(out.rawScore).toBe(0);
    expect(out.score).toBe(0);
    expect(out.overrideApplied).toBe("SAFETY_CRITICAL");
  });

  it("a later safety ATTENTION never downgrades an earlier safety CRITICAL", () => {
    const cfg = oneStatusCat([{ code: "S1", w: 50, sc: true }, { code: "S2", w: 50, sc: true }]);
    const out = computeVHS({ results: [{ pointCode: "S1", status: "CRITICAL" }, { pointCode: "S2", status: "ATTENTION" }], daysSinceInspection: 0 }, cfg);
    expect(out.overrideApplied).toBe("SAFETY_CRITICAL");
  });

  it("bandForScore covers every boundary", () => {
    const cases: Array<[number, Band]> = [[100, "EXCELLENT"], [90, "EXCELLENT"], [89, "GOOD"], [75, "GOOD"], [74, "FAIR"], [60, "FAIR"], [59, "NEEDS_ATTENTION"], [40, "NEEDS_ATTENTION"], [39, "CRITICAL"], [0, "CRITICAL"]];
    for (const [score, band] of cases) expect(bandForScore(score)).toBe(band);
  });

  it("starsFor maps every band", () => {
    expect(starsFor("EXCELLENT")).toBe(5);
    expect(starsFor("GOOD")).toBe(4);
    expect(starsFor("FAIR")).toBe(3);
    expect(starsFor("NEEDS_ATTENTION")).toBe(2);
    expect(starsFor("CRITICAL")).toBe(1);
  });
});
