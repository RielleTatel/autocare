import React from "react";

export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = Gauge Blue fill · secondary = outlined · deep = navy chrome action · danger = destructive · ghost = inline link-action */
  variant?: "primary" | "secondary" | "deep" | "danger" | "ghost";
  /** "member" = 48dp target (member app, web). "field" = 56dp + 18px label (gloved hands). */
  size?: "member" | "field";
  block?: boolean;
  disabled?: boolean;
  /** Leading icon element, rendered before the label. */
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}

/**
 * The AutoCare+ action control — 48dp member / 56dp field, radius 6.
 * @startingPoint section="Core" subtitle="Action buttons, member and field sizes" viewport="700x180"
 */
export declare function Button(props: ButtonProps): React.ReactElement;
