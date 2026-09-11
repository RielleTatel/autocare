import React from "react";

export type PointStatus = "GOOD" | "MONITOR" | "ATTENTION" | "CRITICAL" | "NOT_APPLICABLE";

export interface StatusChoiceProps {
  status: PointStatus;
  selected?: boolean;
  /** True when a measured value has already derived a different status. */
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export interface StatusChipProps {
  status: PointStatus;
  style?: React.CSSProperties;
}

/** Full-width 56dp inspection verdict button (F-06). */
export declare function StatusChoice(props: StatusChoiceProps): React.ReactElement;
/** Live derived-status chip shown under a measured value. */
export declare function StatusChip(props: StatusChipProps): React.ReactElement;
