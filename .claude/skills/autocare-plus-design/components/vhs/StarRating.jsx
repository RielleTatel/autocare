import React from "react";
import { BANDS, bandForScore } from "./BandChip";

const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const STARS_FOR = { EXCELLENT: 5, GOOD: 4, FAIR: 3, NEEDS_ATTENTION: 2, CRITICAL: 1 };

/** A display transform over the band — never a second scoring system.
 *  5 = Excellent, 4 = Good, 3 = Fair, 2 = Needs attention, 1 = Critical. */
export function StarRating({ score, band, size = 20, style }) {
  const key = band || bandForScore(score);
  const filled = STARS_FOR[key];
  const color = BANDS[key].fill;
  return (
    <span role="img" aria-label={`${filled} out of 5 stars — ${BANDS[key].labelEn}`}
      style={{ display: "inline-flex", gap: 2, ...style }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d={STAR} fill={i <= filled ? color : "none"} stroke={color} strokeWidth={i <= filled ? 0 : 1.5} />
        </svg>
      ))}
    </span>
  );
}
