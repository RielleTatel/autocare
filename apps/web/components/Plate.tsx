import type { HTMLAttributes, ReactNode } from "react";

type Variant = "outline" | "chip" | "plain";

const VARIANT: Record<Variant, string> = {
  outline: "border border-ink rounded-sm px-2 py-1 text-ink",
  chip: "bg-primary-deep text-white rounded-sm px-2 py-1",
  plain: "text-ink",
};

export interface PlateProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  /** outline = bordered plate specimen · chip = navy chip on a card · plain = inline mono run */
  variant?: Variant;
}

/** Machine identity in mono with letter-spacing — plates, VINs, verification codes. */
export function Plate({ children, variant = "plain", className = "", ...rest }: PlateProps) {
  const cls = [
    "inline-block font-mono tracking-[0.12em] whitespace-nowrap",
    VARIANT[variant],
    className,
  ].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
