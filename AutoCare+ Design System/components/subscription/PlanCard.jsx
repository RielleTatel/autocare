import React from "react";

const INTERVAL_LABEL = { MONTHLY: "/month", QUARTERLY: "/quarter", ANNUAL: "/year" };

/** Membership plan: name, price in the display face, lock-in, inclusions,
 *  and one primary action. Inclusions are listed in full — never "and more". */
export function PlanCard({ name, price, interval = "MONTHLY", lockInMonths = 0, inclusions = [], selected, actionLabel = "Choose this plan", onSelect, style }) {
  return (
    <div onClick={onSelect} role="button" tabIndex={0}
      style={{
        background: "var(--ac-surface)", borderRadius: "var(--ac-radius-md)", padding: "var(--ac-space-md)",
        border: selected ? "var(--ac-border-control) solid var(--ac-primary)" : "1px solid var(--ac-line)",
        display: "flex", flexDirection: "column", cursor: "pointer", boxSizing: "border-box", ...style,
      }}>
      <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>{name}</div>
      <div style={{ font: "var(--type-h1)", color: "var(--ac-primary-deep)", marginTop: "var(--ac-space-xs)" }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
        <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{INTERVAL_LABEL[interval] || ""}</span>
      </div>
      <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", marginTop: "var(--ac-space-xs)" }}>
        {lockInMonths > 0 ? `${lockInMonths}-month lock-in` : "No lock-in"}
      </div>
      <ul style={{ margin: "var(--ac-space-sm) 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {inclusions.map((i, n) => (
          <li key={n} style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>• {i}</li>
        ))}
      </ul>
      <div style={{
        height: "var(--ac-target-member)", marginTop: "var(--ac-space-sm)", borderRadius: "var(--ac-radius-sm)",
        background: "var(--ac-primary)", color: "var(--ac-on-primary)", display: "flex",
        alignItems: "center", justifyContent: "center", font: "var(--type-body)", fontWeight: 600,
      }}>{actionLabel}</div>
    </div>
  );
}
