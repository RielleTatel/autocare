import type { CSSProperties, ReactNode } from "react";
import { Card } from "./Card";

type Tone = "empty" | "loading" | "error";

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** empty = nothing to show (positive) · loading = skeleton lines · error = red heading + recovery copy */
  tone?: Tone;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** One card shape for empty, loading and error — an absence never reads as a bug. */
export function EmptyState({ title, body, tone = "empty", action, className, style }: EmptyStateProps) {
  if (tone === "loading") {
    return (
      <Card pad="lg" className={className} style={style}>
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={title}>
          <div className="h-4 w-1/2 rounded-sm bg-line animate-pulse" />
          <div className="h-4 w-full rounded-sm bg-line animate-pulse" />
          <div className="h-4 w-2/3 rounded-sm bg-line animate-pulse" />
        </div>
      </Card>
    );
  }
  return (
    <Card pad="lg" className={className} style={style}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className={`font-display text-lg ${tone === "error" ? "text-danger" : "text-ink"}`}>{title}</h2>
        {body && <p className="text-ink-muted text-sm">{body}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Card>
  );
}
