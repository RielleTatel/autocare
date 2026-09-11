import React from "react";

const VARIANT = {
  primary: { background: "var(--ac-primary)", color: "var(--ac-on-primary)", border: "none" },
  secondary: { background: "transparent", color: "var(--ac-primary)", border: "var(--ac-border-control) solid var(--ac-primary)" },
  deep: { background: "var(--ac-primary-deep)", color: "var(--ac-on-primary)", border: "none" },
  danger: { background: "var(--ac-danger)", color: "#FFFFFF", border: "none" },
  ghost: { background: "transparent", color: "var(--ac-primary)", border: "none" },
};

/** The product's one action control. Labels say exactly what happens ("Book a
 *  service", never "Submit"); destructive actions are red and always confirm. */
export function Button({ children, variant = "primary", size = "member", block, disabled, icon, onClick, type = "button", style, ...rest }) {
  const v = VARIANT[variant] || VARIANT.primary;
  const field = size === "field";
  const height = field ? "var(--ac-target-field)" : "var(--ac-target-member)";
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--ac-space-sm)",
    fontFamily: "var(--ac-font-body)", fontWeight: "var(--ac-weight-strong)",
    fontSize: field ? "18px" : "16px", lineHeight: 1,
    height, minHeight: height, padding: `0 ${field ? "var(--ac-space-lg)" : "var(--ac-space-lg)"}`,
    borderRadius: "var(--ac-radius-sm)", cursor: disabled ? "not-allowed" : "pointer",
    width: block ? "100%" : undefined, textAlign: "center",
    transition: "background var(--ac-duration-fast) var(--ac-ease-standard), opacity var(--ac-duration-instant) linear",
    ...v,
  };
  if (disabled) Object.assign(base, { background: "var(--ac-line)", color: "var(--ac-ink-muted)", border: "none" });
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
