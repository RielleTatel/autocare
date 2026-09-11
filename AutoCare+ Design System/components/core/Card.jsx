import React from "react";

/** The universal container: white surface, 1px steel hairline, radius 12.
 *  Elevation in AutoCare+ is the hairline, not a shadow. */
export function Card({ children, pad = "md", accent, interactive, onClick, style, ...rest }) {
  const padding = pad === "none" ? 0 : pad === "lg" ? "var(--ac-space-lg)" : "var(--ac-space-md)";
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        background: "var(--ac-surface)", border: "1px solid var(--ac-line)",
        borderRadius: "var(--ac-radius-md)", padding,
        borderLeft: accent ? `var(--ac-border-accent-row) solid ${accent}` : undefined,
        cursor: interactive ? "pointer" : undefined,
        boxSizing: "border-box", ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
