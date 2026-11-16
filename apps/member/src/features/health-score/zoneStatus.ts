import { DIAGRAM_ZONES, type DiagramZone } from "@autocare/contracts";
import { deriveStatus, type PointStatus } from "@autocare/scoring";
import type { InspectionResultDetail } from "./healthScoreApi";

/** Higher wins. NOT_APPLICABLE is absent on purpose — it never colours a zone. */
const SEVERITY: Record<string, number> = {
  GOOD: 0, MONITOR: 1, ATTENTION: 2, CRITICAL: 3,
};

type StatusResult = Pick<InspectionResultDetail, "status"> & Partial<Pick<InspectionResultDetail, "measuredValue" | "thresholds" | "inputType">>;

/** Resolve measurements with the same thresholds and precedence as scoring. */
export function effectiveStatus(result: StatusResult): PointStatus | undefined {
  const { measuredValue, thresholds } = result;
  // Legacy API responses omit inputType; thresholds identify those measured points.
  if (result.inputType !== "STATUS" && typeof measuredValue === "number" && Number.isFinite(measuredValue) && thresholds &&
      (thresholds.direction === "HIGHER_BETTER" || thresholds.direction === "LOWER_BETTER") &&
      [thresholds.good, thresholds.monitor, thresholds.attention].every(Number.isFinite)) {
    return deriveStatus(measuredValue, { ...thresholds, direction: thresholds.direction });
  }
  return result.status && (result.status === "NOT_APPLICABLE" || SEVERITY[result.status] !== undefined)
    ? result.status : undefined;
}

export function statusLabel(status: PointStatus | undefined): string {
  return ({ GOOD: "Good", MONITOR: "Monitor", ATTENTION: "Needs attention", CRITICAL: "Critical", NOT_APPLICABLE: "Not applicable" } as const)[status!] ?? "Status unavailable";
}

const KNOWN_ZONES = new Set<string>(DIAGRAM_ZONES);

export function worstStatus(
  a: PointStatus | undefined,
  b: PointStatus | undefined,
): PointStatus | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return (SEVERITY[a] ?? -1) >= (SEVERITY[b] ?? -1) ? a : b;
}

/**
 * Collapse inspection results into one status per zone, keeping the worst.
 *
 * Dropped on purpose: points with no zone (position unknown — they stay visible
 * in list view instead), NOT_APPLICABLE points (excluded from scoring too), and
 * unrecorded statuses. Unknown zone strings are ignored rather than thrown on,
 * so an app can safely render an inspection from a newer checklist version.
 */
export function zoneStatuses(
  results: (Pick<InspectionResultDetail, "diagramZone"> & StatusResult)[],
): Partial<Record<DiagramZone, PointStatus>> {
  const out: Partial<Record<DiagramZone, PointStatus>> = {};
  for (const r of results) {
    const zone = r.diagramZone;
    if (!zone || !KNOWN_ZONES.has(zone)) continue;
    const status = effectiveStatus(r);
    if (!status || SEVERITY[status] === undefined) continue;
    out[zone] = worstStatus(out[zone], status);
  }
  return out;
}
