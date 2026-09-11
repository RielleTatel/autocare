import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "deep" | "danger" | "ghost";
type Size = "member" | "field";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white",
  secondary: "bg-transparent text-primary border border-primary",
  deep: "bg-primary-deep text-white",
  danger: "bg-danger text-white",
  ghost: "bg-transparent text-primary",
};

const SIZE: Record<Size, string> = {
  member: "h-12 px-6 text-base",
  field: "h-14 px-6 text-lg",
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  /** primary = Gauge Blue fill · secondary = outlined · deep = navy chrome · danger = destructive · ghost = inline link-action */
  variant?: Variant;
  /** "member" = 48dp target (member app, web). "field" = 56dp + 18px label. */
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
}

/**
 * The AutoCare+ action control — 48dp member / 56dp field, pill radius (2026
 * re-skin). Labels say exactly what happens ("Book a service", never
 * "Submit"); destructive is red.
 */
export function Button({
  children, variant = "primary", size = "member", block, disabled, icon,
  type = "button", className = "", ...rest
}: ButtonProps) {
  const look = disabled ? "bg-line text-ink-muted cursor-not-allowed" : `${VARIANT[variant]} cursor-pointer`;
  const cls = [
    "inline-flex items-center justify-center gap-2 rounded-pill font-body font-semibold text-center",
    "transition-colors",
    SIZE[size], look, block ? "w-full" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button type={type} disabled={disabled} className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}
