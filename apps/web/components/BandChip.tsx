export type BandName = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL";

const LABEL: Record<BandName, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_ATTENTION: "Needs Attention",
  CRITICAL: "Critical",
};

const VAR: Record<BandName, string> = {
  EXCELLENT: "var(--ac-band-excellent)",
  GOOD: "var(--ac-band-good)",
  FAIR: "var(--ac-band-fair)",
  NEEDS_ATTENTION: "var(--ac-band-attention)",
  CRITICAL: "var(--ac-band-critical)",
};

const STARS: Record<BandName, 1 | 2 | 3 | 4 | 5> = {
  EXCELLENT: 5, GOOD: 4, FAIR: 3, NEEDS_ATTENTION: 2, CRITICAL: 1,
};

/** The protected band fill for a band. Never inline a band hex — use this. */
export function bandVar(band: BandName): string {
  return VAR[band];
}

export function starsForBand(band: BandName): 1 | 2 | 3 | 4 | 5 {
  return STARS[band];
}

/** The VHS band as a filled chip. Band colour here means score — product data. */
export function BandChip({ band }: { band: BandName }) {
  return (
    <span
      className="inline-block rounded-pill px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide text-white"
      style={{ background: bandVar(band) }}
    >
      {LABEL[band]}
    </span>
  );
}
