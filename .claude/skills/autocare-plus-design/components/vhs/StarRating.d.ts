import React from "react";
import type { Band } from "./BandChip";

export interface StarRatingProps {
  score?: number;
  band?: Band;
  /** Star box in px. 16 in list rows, 20 default, 22 in the explain sheet. */
  size?: number;
  style?: React.CSSProperties;
}

/** Band-derived 5-star rating, coloured in the band fill. */
export declare function StarRating(props: StarRatingProps): React.ReactElement;
