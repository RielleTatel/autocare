import React from "react";

export type AttentionSeverity = "CRITICAL" | "ATTENTION" | "MONITOR" | "INFO";

export interface AttentionItemRowProps {
  title: string;
  /** Plain-language finding and what to do about it, two lines max. */
  body: string;
  plate?: string;
  severity?: AttentionSeverity;
  /** Show the plate on the right — only when the list spans several vehicles. */
  showPlate?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** A single open item in the "What Needs Attention" list (M-38). */
export declare function AttentionItemRow(props: AttentionItemRowProps): React.ReactElement;
export declare const SEVERITY: Record<AttentionSeverity, { color: string; label: string }>;
