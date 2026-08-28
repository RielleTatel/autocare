import { DIAGRAM_ZONES, type DiagramZone } from "@autocare/contracts";
import type { PointStatus } from "@autocare/scoring";
import type { InspectionResultDetail } from "./healthScoreApi";

/** Higher wins. NOT_APPLICABLE is absent on purpose — it never colours a zone. */
const SEVERITY: Record<string, number> = {
  GOOD: 0, MONITOR: 1, ATTENTION: 2, CRITICAL: 3,
};

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
  results: Pick<InspectionResultDetail, "diagramZone" | "status">[],
): Partial<Record<DiagramZone, PointStatus>> {
  const out: Partial<Record<DiagramZone, PointStatus>> = {};
  for (const r of results) {
    const zone = r.diagramZone;
    if (!zone || !KNOWN_ZONES.has(zone)) continue;
    const status = r.status;
    if (!status || SEVERITY[status] === undefined) continue;
    out[zone] = worstStatus(out[zone], status);
  }
  return out;
}
