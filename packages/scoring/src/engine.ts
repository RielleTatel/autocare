import type { Band, ChecklistConfig, Confidence, InspectionInput, Override, PointStatus, ScoreResult, Thresholds } from "./types";

const FACTORS: Record<Exclude<PointStatus, "NOT_APPLICABLE">, number> = {
  GOOD: 1.0, MONITOR: 0.75, ATTENTION: 0.4, CRITICAL: 0.0,
};
const round = (n: number, dp: number) => { const f = 10 ** dp; return Math.round(n * f) / f; };

export function deriveStatus(value: number, t: Thresholds): PointStatus {
  if (t.direction === "HIGHER_BETTER") {
    if (value >= t.good) return "GOOD";
    if (value >= t.monitor) return "MONITOR";
    if (value >= t.attention) return "ATTENTION";
    return "CRITICAL";
  }
  if (value < t.good) return "GOOD";
  if (value < t.monitor) return "MONITOR";
  if (value < t.attention) return "ATTENTION";
  return "CRITICAL";
}

export function bandForScore(score: number): Band {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}

/** Band → star count per §11.5. Stars derive from the capped score's band,
 *  so a safety override drags the stars down with it (FR-114). */
export function starsFor(band: Band): 1 | 2 | 3 | 4 | 5 {
  switch (band) {
    case "EXCELLENT": return 5;
    case "GOOD": return 4;
    case "FAIR": return 3;
    case "NEEDS_ATTENTION": return 2;
    case "CRITICAL": return 1;
  }
}

export function computeVHS(inspection: InspectionInput, config: ChecklistConfig): ScoreResult {
  const byCode = new Map(inspection.results.map(r => [r.pointCode, r]));
  let totalPoints = 0, completedPoints = 0;
  let safetyWorst: "NONE" | "ATTENTION" | "CRITICAL" = "NONE";
  const categoryScores: ScoreResult["categoryScores"] = [];
  const detractors: Array<ScoreResult["topDetractors"][number] & { isSafetyCritical: boolean }> = [];

  // Resolve every point's status once
  const resolved = config.categories.map(cat => ({
    cat,
    points: cat.points.map(pt => {
      totalPoints += 1;
      const r = byCode.get(pt.code);
      let status: PointStatus | undefined;
      if (pt.inputType === "MEASURED" && r?.measuredValue !== undefined && pt.thresholds) {
        status = deriveStatus(r.measuredValue, pt.thresholds);
      } else if (r?.status) {
        status = r.status;
      }
      if (status !== undefined) completedPoints += 1;
      return { pt, status };
    }),
  }));

  for (const { points } of resolved) {
    for (const { pt, status } of points) {
      if (pt.isSafetyCritical && status === "CRITICAL") safetyWorst = "CRITICAL";
      else if (pt.isSafetyCritical && status === "ATTENTION" && safetyWorst !== "CRITICAL") safetyWorst = "ATTENTION";
    }
  }

  // Category sub-scores over applicable, answered points
  let weightedSum = 0, weightTotal = 0;
  for (const { cat, points } of resolved) {
    const applicable = points.filter(x => x.status !== undefined && x.status !== "NOT_APPLICABLE");
    if (applicable.length === 0) { categoryScores.push({ categoryCode: cat.code, label: cat.label, weight: cat.weight, score: 0, applicablePoints: 0, stars: 1 }); continue; }
    const wSum = applicable.reduce((s, x) => s + x.pt.weightInCategory, 0);
    if (wSum === 0) { categoryScores.push({ categoryCode: cat.code, label: cat.label, weight: cat.weight, score: 0, applicablePoints: applicable.length, stars: 1 }); continue; }
    const wf = applicable.reduce((s, x) => s + x.pt.weightInCategory * FACTORS[x.status as keyof typeof FACTORS], 0);
    const sub = round(100 * (wf / wSum), 1);
    categoryScores.push({ categoryCode: cat.code, label: cat.label, weight: cat.weight, score: sub, applicablePoints: applicable.length, stars: starsFor(bandForScore(sub)) });
    weightedSum += cat.weight * sub;
    weightTotal += cat.weight;
    for (const x of applicable) {
      const factor = FACTORS[x.status as keyof typeof FACTORS];
      if (factor < 1) {
        const impact = round((cat.weight * x.pt.weightInCategory * (1 - factor)) / wSum, 2);
        detractors.push({ pointCode: x.pt.code, label: x.pt.label, status: x.status!, scoreImpact: impact, recommendation: x.pt.recommendation, isSafetyCritical: x.pt.isSafetyCritical });
      }
    }
  }

  const rawScore = round(weightTotal === 0 ? 0 : weightedSum / weightTotal, 3);
  let overrideApplied: Override = "NONE";
  let capped = rawScore;
  if (safetyWorst === "CRITICAL") { capped = Math.min(rawScore, 49); overrideApplied = "SAFETY_CRITICAL"; }
  else if (safetyWorst === "ATTENTION") { capped = Math.min(rawScore, 69); overrideApplied = "SAFETY_ATTENTION"; }
  const score = Math.min(100, Math.max(0, Math.round(capped)));

  const completion = totalPoints === 0 ? 0 : completedPoints / totalPoints;
  const days = inspection.daysSinceInspection;
  let confidence: Confidence = "LOW";
  if (completion >= 0.95 && days <= 30) confidence = "HIGH";
  else if (completion >= 0.85 && days <= 90) confidence = "MEDIUM";

  // The cap loss belongs to the safety point(s) that triggered the override —
  // they are why the score fell from rawScore to the cap, so they must rank first.
  if (overrideApplied !== "NONE" && rawScore > capped) {
    const triggerStatus: PointStatus = overrideApplied === "SAFETY_CRITICAL" ? "CRITICAL" : "ATTENTION";
    const capDelta = round(rawScore - capped, 2);
    for (const d of detractors) {
      if (d.isSafetyCritical && d.status === triggerStatus) d.scoreImpact = round(d.scoreImpact + capDelta, 2);
    }
  }
  detractors.sort((a, b) => b.scoreImpact - a.scoreImpact);
  const band = bandForScore(score);
  return {
    score, rawScore, band, confidence, stars: starsFor(band), categoryScores,
    overrideApplied,
    topDetractors: detractors.slice(0, 3).map(({ isSafetyCritical: _sc, ...d }) => d),
    checklistVersion: config.checklistVersion, weightVersion: config.weightVersion,
  };
}
