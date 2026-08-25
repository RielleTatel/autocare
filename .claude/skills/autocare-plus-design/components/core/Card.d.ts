import React from "react";

export interface CardProps {
  children?: React.ReactNode;
  /** md = 16px (default, mobile) · lg = 24px (web, roomy) · none = flush content */
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity token, e.g. `var(--ac-sev-critical)`. */
  accent?: string;
  interactive?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Surface container — hairline border, radius 12, no shadow. */
export declare function Card(props: CardProps): React.ReactElement;
