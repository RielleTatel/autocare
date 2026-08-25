import React from "react";

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** empty = nothing to show (positive) · loading = skeleton lines · error = red heading + recovery copy */
  tone?: "empty" | "loading" | "error";
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/** One card shape for empty, loading and error — an absence never reads as a bug. */
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;
