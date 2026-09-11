import React from "react";

export interface CategoryBarProps {
  label: string;
  /** 0–100 category score; the bar and number take the band colour. */
  score: number;
  /** Category weight in percent — shown so the member can see how it counted. */
  weight?: number;
  /** Applicable points checked in this category. */
  points?: number;
  showStars?: boolean;
  /** compact drops the stars and uses body type — for the certificate list. */
  compact?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Per-category score bar for the VHS breakdown (M-14) and certificate (P-01). */
export declare function CategoryBar(props: CategoryBarProps): React.ReactElement;
