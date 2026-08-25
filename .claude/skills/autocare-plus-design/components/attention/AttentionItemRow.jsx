import React from "react";

export const SEVERITY = {
  CRITICAL: { color: "var(--ac-sev-critical)", label: "Critical" },
  ATTENTION: { color: "var(--ac-sev-attention)", label: "Needs attention" },
  MONITOR: { color: "var(--ac-sev-monitor)", label: "Monitor" },
  INFO: { color: "var(--ac-sev-info)", label: "Info" },
};

/** One open item. Severity is a 5px left edge plus the word — the row never
 *  relies on colour alone. Tapping deep-links to the source screen. */
export function AttentionItemRow({ title, body, plate, severity = "INFO", showPlate, onClick, style }) {
  const s = SEVERITY[severity] || SEVERITY.INFO;
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      style={{
        background: "var(--ac-surface)", border: "1px solid var(--ac-line)",
        borderLeft: `var(--ac-border-accent-row) solid ${s.color}`, borderRadius: "var(--ac-radius-md)",
        padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-xs)",
        cursor: onClick ? "pointer" : undefined, boxSizing: "border-box", ...style,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
        <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)", flex: 1 }}>{title}</span>
        {showPlate && plate && (
          <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: "var(--ac-size-label)", color: "var(--ac-ink-muted)" }}>{plate}</span>
        )}
      </div>
      <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>{body}</div>
      <div style={{ font: "var(--type-label)", color: s.color }}>{s.label} ›</div>
    </div>
  );
}
