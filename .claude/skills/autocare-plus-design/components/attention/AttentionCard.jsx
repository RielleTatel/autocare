import React from "react";
import { SEVERITY } from "./AttentionItemRow";

const ORDER = ["CRITICAL", "ATTENTION", "MONITOR", "INFO"];

/** The member home's answer to "what do I do next?" — severity counts, the most
 *  severe item verbatim, and a way to see the rest. Renders an explicit empty
 *  state; it is never hidden. */
export function AttentionCard({ items = [], onSeeAll, onPressItem, style }) {
  const shell = {
    background: "var(--ac-surface)", border: "1px solid var(--ac-line-soft)", boxShadow: "var(--ac-elevation-card)",
    borderRadius: "var(--ac-radius-lg)", padding: "var(--ac-space-lg)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)",
    boxSizing: "border-box", ...style,
  };
  if (items.length === 0) {
    return (
      <div style={shell}>
        <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Nothing needs attention right now</div>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)", marginTop: -6 }}>Your vehicles are up to date.</div>
      </div>
    );
  }
  const counts = ORDER.map((sev) => ({ sev, n: items.filter((i) => i.severity === sev).length })).filter((c) => c.n > 0);
  const top = items[0];
  return (
    <div style={shell}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ac-space-sm)" }}>
        <span style={{ font: "var(--type-h1)", color: "var(--ac-ink)", whiteSpace: "nowrap" }}>Needs attention</span>
        <span style={{ display: "inline-flex", gap: "var(--ac-space-xs)" }}>
          {counts.map((c) => (
            <span key={c.sev} aria-label={`${c.n} ${c.sev.toLowerCase()}`} style={{
              minWidth: 24, height: 24, borderRadius: 12, background: SEVERITY[c.sev].color, color: "#FFFFFF",
              display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
              font: "var(--type-label)", fontVariantNumeric: "tabular-nums",
            }}>{c.n}</span>
          ))}
        </span>
      </div>
      <div role="button" tabIndex={0} onClick={() => onPressItem && onPressItem(top)}
        style={{ borderLeft: `var(--ac-border-accent) solid ${SEVERITY[top.severity].color}`, paddingLeft: "var(--ac-space-sm)", cursor: onPressItem ? "pointer" : undefined }}>
        <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>{top.title}{top.plate ? ` · ${top.plate}` : ""}</div>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>{top.body}</div>
      </div>
      {onSeeAll && (
        <div role="button" tabIndex={0} onClick={onSeeAll}
          style={{ minHeight: 40, display: "flex", alignItems: "center", font: "var(--type-body)", fontWeight: 600, color: "var(--ac-primary)", cursor: "pointer" }}>
          See all {items.length} ›
        </div>
      )}
    </div>
  );
}
