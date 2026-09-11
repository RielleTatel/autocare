import React from "react";

export type Band = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL";

export interface BandChipProps {
  /** 0–100. Ignored when `band` is given. */
  score?: number;
  band?: Band;
  /** Prefix the numeric range of the band, in mono. */
  showRange?: boolean;
  /** Append the Filipino label — required wherever the label stands alone. */
  showFil?: boolean;
  style?: React.CSSProperties;
}

/** The five-band VHS label as a filled pill. Colour never travels alone. */
export declare function BandChip(props: BandChipProps): React.ReactElement;
export declare function bandForScore(score: number): Band;
export declare const BANDS: Record<Band, { min: number; fill: string; text: string; labelEn: string; labelFil: string }>;
