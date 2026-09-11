import React from "react";
import { BANDS, bandForScore } from "./BandChip";
import { StarRating } from "./StarRating";

/** One inspection category: label, score, band-coloured bar, and the weight +
 *  point-count footnote that shows how the number was reached. */
export function CategoryBar({ label, score, weight, points, showStars = true, compact, onClick, style }) {
  const key = bandForScore(score);
  const b = BANDS[key];
  const barH = compact ? 8 : 12;
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-xs)", cursor: onClick ? "pointer" : undefined, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--ac-space-sm)" }}>
        <span style={{ font: compact ? "var(--type-body)" : "var(--type-h2)", color: "var(--ac-ink)" }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          {showStars && !compact && <StarRating score={score} size={16} />}
          <span style={{ font: compact ? "var(--type-body)" : "var(--type-h2)", color: b.text, fontVariantNumeric: "tabular-nums" }}>{Math.round(score)}</span>
        </span>
      </div>
      <div style={{ height: barH, borderRadius: "var(--ac-radius-pill)", background: "var(--ac-chassis)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: b.fill, borderRadius: "var(--ac-radius-pill)" }} />
      </div>
      {(weight != null || points != null) && (
        <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>
          {weight != null ? `Weight ${weight}%` : ""}{weight != null && points != null ? " · " : ""}{points != null ? `${points} points checked` : ""}
        </span>
      )}
    </div>
  );
}
