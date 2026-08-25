import React from "react";

const STATUS = {
  GOOD: { label: "Good", color: "var(--ac-band-excellent)" },
  MONITOR: { label: "Monitor", color: "var(--ac-band-fair)" },
  ATTENTION: { label: "Attention", color: "var(--ac-band-attention)" },
  CRITICAL: { label: "Critical", color: "var(--ac-band-critical)" },
  NOT_APPLICABLE: { label: "N/A", color: "var(--ac-ink-muted)" },
};

/** The mechanic's inspection verdict control: one full-width 56dp target per
 *  status, filled in the band colour when selected. Disabled when a measured
 *  value has already derived the status. */
export function StatusChoice({ status, selected, disabled, onClick, style }) {
  const s = STATUS[status] || STATUS.NOT_APPLICABLE;
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={!!selected}
      style={{
        minHeight: "var(--ac-target-field)", width: "100%", borderRadius: "var(--ac-radius-md)",
        border: selected ? "none" : "1px solid var(--ac-line)",
        background: selected ? s.color : "var(--ac-surface)",
        color: selected ? "#FFFFFF" : "var(--ac-ink)",
        font: "var(--type-h2)", opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background var(--ac-duration-fast) var(--ac-ease-standard)", ...style,
      }}>{s.label}</button>
  );
}

/** The small derived-status chip shown live beneath a measured value. */
export function StatusChip({ status, style }) {
  const s = STATUS[status] || STATUS.NOT_APPLICABLE;
  return (
    <span style={{
      display: "inline-block", background: s.color, color: "#FFFFFF",
      borderRadius: "var(--ac-radius-pill)", padding: "var(--ac-space-xs) var(--ac-space-md)",
      font: "var(--type-label)", ...style,
    }}>{s.label}</span>
  );
}
