import type { PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";

/**
 * Point status → band fill. Extracted from HealthScoreScreen so the detractor
 * cards, the diagram, and the zone sheet cannot drift apart.
 *
 * The status→band pairing is the design system's own severity alias set
 * (--ac-sev-critical → band-critical, etc). Do not introduce a second palette.
 * Unknown values fall back to muted ink so a newer checklist can never crash
 * an older app.
 */
export function statusColor(status: PointStatus | string): string {
  switch (status) {
    case "CRITICAL": return theme.vhsBands.CRITICAL.fill;
    case "ATTENTION": return theme.vhsBands.NEEDS_ATTENTION.fill;
    case "MONITOR": return theme.vhsBands.FAIR.fill;
    default: return theme.colors.inkMuted;
  }
}
