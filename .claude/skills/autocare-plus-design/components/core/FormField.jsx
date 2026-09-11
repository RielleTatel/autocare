import React from "react";

/** Labelled input. Errors say what went wrong and what to do next — never a
 *  raw code (NFR-032). Uppercase label, sunken field, 48dp height. */
export function FormField({ label, value, placeholder, error, hint, mono, size = "member", type = "text", onChange, id, style }) {
  const height = size === "field" ? "var(--ac-target-field)" : "var(--ac-target-member)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-xs)", ...style }}>
      {label && (
        <label htmlFor={id} style={{
          font: "var(--type-label)", color: "var(--ac-ink-muted)",
          letterSpacing: "var(--ac-tracking-label)", textTransform: "uppercase",
        }}>{label}</label>
      )}
      <input
        id={id} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          fontFamily: mono ? "var(--ac-font-mono)" : "var(--ac-font-body)",
          letterSpacing: mono ? "var(--ac-tracking-code)" : undefined,
          fontSize: "16px", color: "var(--ac-ink)", background: "var(--ac-surface-soft)",
          border: `var(--ac-border-control) solid ${error ? "var(--ac-danger)" : "var(--ac-line-soft)"}`,
          borderRadius: "var(--ac-radius-sm)", height, padding: "0 18px", boxSizing: "border-box", width: "100%",
        }}
      />
      {error && <p style={{ margin: 0, color: "var(--ac-danger)", font: "var(--type-body)", fontSize: "14px" }}>{error}</p>}
      {!error && hint && <p style={{ margin: 0, color: "var(--ac-ink-muted)", font: "var(--type-label)" }}>{hint}</p>}
    </div>
  );
}
