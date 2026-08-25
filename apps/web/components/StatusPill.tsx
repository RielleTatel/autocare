import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";

/** Tone → Tailwind classes. Blue = moving, green = settled, amber = needs
 *  someone, red = stopped, grey = not started. warn uses the FAIR band token. */
const TONE: Record<Tone, string> = {
  neutral: "bg-[color:var(--ac-code-bg)] text-ink",
  info: "bg-primary/10 text-primary border border-primary/35",
  success: "bg-success/10 text-success border border-success/35",
  warn: "bg-[color:var(--ac-band-fair)]/15 text-[color:var(--ac-band-fair)] border border-[color:var(--ac-band-fair)]/40",
  danger: "bg-danger/10 text-danger border border-danger/35",
  solid: "bg-primary text-white",
  solidDeep: "bg-primary-deep text-white",
};

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  /** neutral = not started · info = in motion · success = settled · warn = needs someone · danger = stopped · solid/solidDeep = on-chrome */
  tone?: Tone;
}

/** Mono-caps lifecycle pill — work orders, invoices, trips, roadside. */
export function StatusPill({ children, tone = "neutral", className = "", ...rest }: StatusPillProps) {
  const cls = [
    "inline-block font-mono text-xs font-medium tracking-wide",
    "px-2.5 py-0.5 rounded-pill whitespace-nowrap",
    TONE[tone],
    className,
  ].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
