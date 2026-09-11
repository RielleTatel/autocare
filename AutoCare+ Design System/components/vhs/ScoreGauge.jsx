import React from "react";
import { BANDS, bandForScore } from "./BandChip";

const CONFIDENCE_LABEL = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence" };

function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arcPath(cx, cy, r, fromDeg, toDeg) {
  const s = polar(cx, cy, r, fromDeg), e = polar(cx, cy, r, toDeg);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(toDeg - fromDeg) > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

/** The signature component: a 180° band-coloured arc, the score numeral in the
 *  display face, and the EN/FIL band label. Stale inspections render grey —
 *  an old score is never shown as if it were current. */
export function ScoreGauge({ score, band, confidence, isStale, daysSinceInspection, size = 220, variant = "member", style }) {
  const key = band || bandForScore(score);
  const b = BANDS[key];
  const stroke = 18, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const clamped = Math.max(0, Math.min(100, score));
  const progressDeg = 180 - (clamped / 100) * 180;
  const arcColor = isStale ? "var(--ac-ink-muted)" : b.fill;
  const end = polar(cx, cy, r, progressDeg);
  return (
    <div role="img" aria-label={`Vehicle health score ${clamped} out of 100, ${b.labelEn}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
      <div style={{ position: "relative", width: size, height: size / 2 + stroke }}>
        <svg width={size} height={size / 2 + stroke}>
          <path d={arcPath(cx, cy, r, 180, 0)} stroke="var(--ac-line)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {clamped > 0 && <path d={arcPath(cx, cy, r, 180, progressDeg)} stroke={arcColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />}
          {clamped > 0 && <circle cx={end.x} cy={end.y} r={stroke / 2.5} fill={arcColor} />}
        </svg>
        <div style={{ position: "absolute", top: size / 4, left: 0, right: 0, textAlign: "center" }}>
          <span style={{
            fontFamily: "var(--ac-font-display)", fontWeight: 600, lineHeight: 1,
            fontSize: variant === "field" ? 72 : 56, fontVariantNumeric: "tabular-nums",
            color: isStale ? "var(--ac-ink-muted)" : b.text,
          }}>{clamped}</span>
        </div>
      </div>
      <div style={{ font: "var(--type-h2)", color: isStale ? "var(--ac-ink-muted)" : b.text }}>{b.labelEn}</div>
      <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{b.labelFil}</div>
      {isStale ? (
        <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", marginTop: "var(--ac-space-xs)" }}>
          Inspected {daysSinceInspection ?? "90+"} days ago
        </div>
      ) : confidence ? (
        <div style={{
          marginTop: "var(--ac-space-xs)", borderRadius: "var(--ac-radius-pill)", border: "1px solid var(--ac-line)",
          padding: "2px var(--ac-space-sm)", font: "var(--type-label)", color: "var(--ac-ink-muted)",
        }}>{CONFIDENCE_LABEL[confidence]}</div>
      ) : null}
    </div>
  );
}
