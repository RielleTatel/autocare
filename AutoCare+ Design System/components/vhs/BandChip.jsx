import React from "react";

export const BANDS = {
  EXCELLENT: { min: 90, fill: "#177245", text: "#0F5C37", labelEn: "Excellent", labelFil: "Napakaayos" },
  GOOD: { min: 75, fill: "#5C9E31", text: "#3F7420", labelEn: "Good", labelFil: "Maayos" },
  FAIR: { min: 60, fill: "#B87E00", text: "#8A5F00", labelEn: "Fair", labelFil: "Katamtaman" },
  NEEDS_ATTENTION: { min: 40, fill: "#C75E1B", text: "#9C4204", labelEn: "Needs Attention", labelFil: "Kailangan ng Aksyon" },
  CRITICAL: { min: 0, fill: "#B3261E", text: "#8F1D17", labelEn: "Critical", labelFil: "Delikado" },
};

export function bandForScore(score) {
  for (const [key, b] of Object.entries(BANDS)) if (score >= b.min) return key;
  return "CRITICAL";
}

/** Band chip / inline band label. Colour always ships with the word and,
 *  where there is room, the number — colour is never the only signal. */
export function BandChip({ score, band, showRange, showFil, style }) {
  const key = band || bandForScore(score ?? 0);
  const b = BANDS[key];
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: "var(--ac-space-sm)",
      background: b.fill, color: "#FFFFFF", borderRadius: "var(--ac-radius-pill)",
      padding: "4px 12px", ...style,
    }}>
      {showRange && (
        <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: 12, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>
          {b.min}–{key === "EXCELLENT" ? 100 : (BANDS[Object.keys(BANDS)[Object.keys(BANDS).indexOf(key) - 1]]?.min ?? 100) - 1}
        </span>
      )}
      <span style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{b.labelEn}</span>
      {showFil && <span style={{ fontFamily: "var(--ac-font-body)", fontSize: 12, opacity: 0.85 }}>{b.labelFil}</span>}
    </span>
  );
}
