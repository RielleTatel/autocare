import React from "react";
import type { Band } from "./BandChip";

export interface ScoreGaugeProps {
  /** 0–100, already capped by any safety override. */
  score: number;
  band?: Band;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  /** Inspection older than 90 days — the whole gauge renders grey. */
  isStale?: boolean;
  daysSinceInspection?: number;
  /** Diameter in px. 220 member, 260 certificate. */
  size?: number;
  /** "field" enlarges the numeral to 72px for the mechanic's screen. */
  variant?: "member" | "field";
  style?: React.CSSProperties;
}

/**
 * The Vehicle Health Score gauge — the product's signature element.
 * @startingPoint section="VHS" subtitle="180° score gauge with band label" viewport="700x300"
 */
export declare function ScoreGauge(props: ScoreGaugeProps): React.ReactElement;
