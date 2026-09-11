import React from "react";

/** The universal container. A card is a white surface resting on the chassis
 *  grey: radius 20, soft two-layer shadow, soft border. `flat` drops the shadow
 *  back to the shipped hairline for dense data surfaces (staff console tables).
 *  `major` is the radius-28 hero card. */
export function Card({ children, pad = "md", accent, interactive, flat, major, onClick, style, ...rest }) {
  const padding = pad === "none" ? 0 : pad === "lg" ? "var(--ac-space-lg)" : pad === "sm" ? "var(--ac-space-sm)" : "var(--ac-space-md)";
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        background: "var(--ac-surface)",
        border: flat ? "1px solid var(--ac-line)" : "1px solid var(--ac-line-soft)",
        boxShadow: flat ? "var(--ac-elevation-flat)" : "var(--ac-elevation-card)",
        borderRadius: major ? "var(--ac-radius-lg)" : "var(--ac-radius-md)", padding,
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
