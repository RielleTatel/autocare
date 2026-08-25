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
}

/** Surface container — hairline border, radius 12, no shadow (elevation is line, not shadow). */
export function Card({ children, pad = "md", accent, interactive, className = "", style, ...rest }: CardProps) {
  const cls = [
    "bg-surface rounded-md border border-line",
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
