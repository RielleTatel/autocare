import React from "react";

/** Empty, loading and error states share one shape so an absence never reads as
 *  a bug. Empty states are stated positively ("Nothing needs attention right
 *  now"), never hidden (FR-113). */
export function EmptyState({ title, body, tone = "empty", action, style }) {
  const accent = tone === "error" ? "var(--ac-danger)" : tone === "loading" ? "var(--ac-ink-muted)" : "var(--ac-ink)";
  return (
    <div style={{
      background: "var(--ac-surface)", border: "1px solid var(--ac-line-soft)", boxShadow: "var(--ac-elevation-card)", borderRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-lg)", display: "flex", flexDirection: "column", gap: "var(--ac-space-xs)",
      alignItems: "flex-start", ...style,
    }}>
      {tone === "loading" && (
        <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", marginBottom: 4 }}>
          <div style={{ height: 10, width: "42%", borderRadius: 999, background: "var(--ac-line)" }} />
          <div style={{ height: 10, width: "68%", borderRadius: 999, background: "var(--ac-code-bg)" }} />
        </div>
      )}
      <div style={{ font: "var(--type-h2)", color: accent }}>{title}</div>
      {body && <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>{body}</div>}
      {action}
    </div>
  );
}
