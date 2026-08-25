import React from "react";

/** Member app bottom tabs. Active tint is Gauge Blue, inactive is muted ink;
 *  49dp bar over a hairline. Labels are nouns, never verbs. */
export function TabBar({ tabs = [], active, onChange, style }) {
  return (
    <nav style={{
      display: "flex", height: 56, borderTop: "1px solid var(--ac-line)",
      background: "var(--ac-surface)", ...style,
    }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} type="button" onClick={() => onChange && onChange(t.key)}
            aria-current={on ? "page" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 2, border: "none", background: "transparent", cursor: "pointer",
              color: on ? "var(--ac-primary)" : "var(--ac-ink-muted)",
            }}>
            <span aria-hidden style={{ display: "flex", width: 22, height: 22 }}>{t.icon}</span>
            <span style={{ fontFamily: "var(--ac-font-body)", fontSize: 11, fontWeight: on ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
