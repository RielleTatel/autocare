import { bandForScore, starsFor } from "./engine";
import type { PointStatus, StatusTemplates, Thresholds } from "./types";

/** The subset of a checklist point needed to explain a finding (FR-115).
 *  Templates arrive as an argument — this function never reads the DB, so it is
 *  callable from the API, the member app, and later the deferred diagram. */
export interface ExplainPoint {
  code: string;
  label: string;
  unit?: string;
  thresholds?: Thresholds;
  templates?: StatusTemplates;
}

export interface ExplainContext {
  measuredValue?: number;
}

/** Score → star count, via the score's band (§11.5). Same map as starsFor,
 *  exposed for display code that only has a numeric score. */
export function starsForScore(score: number): 1 | 2 | 3 | 4 | 5 {
  return starsFor(bandForScore(score));
}

// The threshold surfaced in an explanation is the boundary the component must
// reach to move up to the next-better status — the "recommended limit" the
// reader wants to restore it to.
const THRESHOLD_FOR_STATUS: Record<Exclude<PointStatus, "NOT_APPLICABLE">, keyof Thresholds | null> = {
  GOOD: "good",
  MONITOR: "good",
  ATTENTION: "monitor",
  CRITICAL: "attention",
};

/** One plain-language sentence for a component's finding. Returns null for
 *  NOT_APPLICABLE (nothing to explain); falls back to a generic sentence when
 *  the point has no template for the given status (§11.6a "Fallback" row). */
export function renderExplanation(point: ExplainPoint, status: PointStatus, ctx: ExplainContext): string | null {
  if (status === "NOT_APPLICABLE") return null;

  const template = point.templates?.[status];
  const values = substitutions(point, status, ctx);
  if (template) return fill(template, values);
  return genericFallback(point, status, ctx);
}

function substitutions(point: ExplainPoint, status: Exclude<PointStatus, "NOT_APPLICABLE">, ctx: ExplainContext): Record<string, string> {
  const unit = point.unit ?? "";
  const thresholdKey = THRESHOLD_FOR_STATUS[status];
  const threshold = thresholdKey && point.thresholds ? String(point.thresholds[thresholdKey]) : "";
  return {
    component: point.label,
    measured: ctx.measuredValue !== undefined ? String(ctx.measuredValue) : "",
    threshold,
    unit,
  };
}

function fill(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
    .replace(/\s{2,}/g, " ") // collapse gaps left by empty substitutions
    .trim();
}

const STATUS_PHRASE: Record<Exclude<PointStatus, "NOT_APPLICABLE">, string> = {
  GOOD: "is in good condition and needs no action",
  MONITOR: "should be monitored — it is approaching its recommended limit",
  ATTENTION: "needs attention soon",
  CRITICAL: "is in unsafe condition and should be addressed before driving further",
};

function genericFallback(point: ExplainPoint, status: Exclude<PointStatus, "NOT_APPLICABLE">, ctx: ExplainContext): string {
  const measured = ctx.measuredValue !== undefined ? ` (${ctx.measuredValue}${point.unit ? ` ${point.unit}` : ""})` : "";
  const statusWord = status.charAt(0) + status.slice(1).toLowerCase();
  return `${point.label} ${STATUS_PHRASE[status]}${measured}. [${statusWord}]`;
}
