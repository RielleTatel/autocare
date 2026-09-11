import React from "react";

const TONE = {
  neutral: { bg: "var(--ac-code-bg)", fg: "var(--ac-ink)", bd: "transparent" },
  info: { bg: "color-mix(in srgb, var(--ac-primary) 12%, transparent)", fg: "var(--ac-primary)", bd: "color-mix(in srgb, var(--ac-primary) 35%, transparent)" },
  success: { bg: "color-mix(in srgb, var(--ac-success) 12%, transparent)", fg: "var(--ac-success)", bd: "color-mix(in srgb, var(--ac-success) 35%, transparent)" },
  warn: { bg: "color-mix(in srgb, var(--ac-band-fair) 14%, transparent)", fg: "var(--ac-band-fair)", bd: "color-mix(in srgb, var(--ac-band-fair) 40%, transparent)" },
  danger: { bg: "color-mix(in srgb, var(--ac-danger) 12%, transparent)", fg: "var(--ac-danger)", bd: "color-mix(in srgb, var(--ac-danger) 35%, transparent)" },
  solid: { bg: "var(--ac-primary)", fg: "#FFFFFF", bd: "transparent" },
  solidDeep: { bg: "var(--ac-primary-deep)", fg: "#FFFFFF", bd: "transparent" },
};

/** Lifecycle state, in mono caps. Blue = moving, green = settled,
 *  amber = needs someone, red = stopped, grey = not started. */
export function StatusPill({ children, tone = "neutral", style }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span style={{
      display: "inline-block", fontFamily: "var(--ac-font-mono)", fontSize: "12px", fontWeight: 500,
      letterSpacing: "0.02em", padding: "3px 10px", borderRadius: "var(--ac-radius-pill)",
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap", ...style,
    }}>{children}</span>
  );
}
