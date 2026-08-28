import { bandVar, type BandName } from "./BandChip";

/** Same thresholds as the scoring engine's bandForScore. */
function bandForScore(score: number): BandName {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}

/** One inspection category's score as a labelled bar, filled in its band colour. */
export function CategoryBar({
  label, score, compact,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className={compact ? "text-ink text-xs" : "text-ink text-sm"}>{label}</span>
        <span className="font-mono text-xs text-ink-muted tabular-nums">{clamped}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-pill bg-line"
      >
        <div className="h-full" style={{ width: `${clamped}%`, background: bandVar(bandForScore(clamped)) }} />
      </div>
    </div>
  );
}
