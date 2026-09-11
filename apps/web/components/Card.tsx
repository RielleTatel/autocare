import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type Pad = "md" | "lg" | "none";

const PAD: Record<Pad, string> = { md: "p-4", lg: "p-6", none: "" };

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** md = 16px (default, mobile) · lg = 24px (web, roomy) · none = flush content */
  pad?: Pad;
  /** Left status edge, 5px. Pass a band/severity token, e.g. `var(--ac-sev-critical)`. */
  accent?: string;
  interactive?: boolean;
  /** Drop the soft shadow back to the shipped hairline — dense data surfaces
   *  (staff console tables, the certificate) keep this. */
  flat?: boolean;
  /** Radius 28 instead of the default 20 — major cards, bottom sheets, modals. */
  major?: boolean;
}

/** Surface container — radius 20 (28 with `major`), soft two-layer shadow over
 *  a soft border (2026 re-skin). `flat` reverts to the shipped hairline with no
 *  shadow, for dense data surfaces. */
export function Card({ children, pad = "md", accent, interactive, flat, major, className = "", style, ...rest }: CardProps) {
  const cls = [
    "bg-surface",
    major ? "rounded-lg" : "rounded-md",
    flat ? "border border-line shadow-flat" : "border border-line-soft shadow-card",
    PAD[pad],
    interactive ? "cursor-pointer transition-colors hover:border-primary" : "",
    className,
  ].filter(Boolean).join(" ");
  const merged: CSSProperties = accent ? { borderLeft: `5px solid ${accent}`, ...style } : (style ?? {});
  return (
    <div className={cls} style={merged} {...rest}>
      {children}
    </div>
  );
}
