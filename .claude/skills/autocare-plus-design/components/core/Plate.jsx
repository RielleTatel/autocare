import React from "react";

/** Machine identity: plate numbers, VINs, verification codes. Always mono,
 *  always letter-spaced. `variant="chip"` is the navy chip used on cards. */
export function Plate({ children, variant = "outline", style }) {
  if (variant === "chip") {
    return (
      <span style={{
        display: "inline-block", fontFamily: "var(--ac-font-mono)", fontWeight: 500,
        fontSize: "var(--ac-size-code)", letterSpacing: "var(--ac-tracking-code)", whiteSpace: "nowrap",
        background: "var(--ac-primary-deep)", color: "var(--ac-on-primary)",
        borderRadius: "var(--ac-radius-sm)", padding: "4px var(--ac-space-sm)", ...style,
      }}>{children}</span>
    );
  }
  if (variant === "plain") {
    return (
      <span style={{
        fontFamily: "var(--ac-font-mono)", fontWeight: 500, fontSize: "var(--ac-size-code)",
        letterSpacing: "var(--ac-tracking-code)", whiteSpace: "nowrap", color: "var(--ac-ink)", ...style,
      }}>{children}</span>
    );
  }
  return (
    <span style={{
      display: "inline-block", fontFamily: "var(--ac-font-mono)", fontWeight: 500, fontSize: "18px",
      letterSpacing: "var(--ac-tracking-plate)", whiteSpace: "nowrap", background: "var(--ac-surface)", color: "var(--ac-ink)",
      border: "2px solid var(--ac-ink)", borderRadius: "var(--ac-radius-sm)", padding: "4px 14px", ...style,
    }}>{children}</span>
  );
}
