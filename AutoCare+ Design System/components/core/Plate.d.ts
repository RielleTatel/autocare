import React from "react";

export interface PlateProps {
  children?: React.ReactNode;
  /** outline = bordered plate specimen · chip = navy chip on a card · plain = inline mono run */
  variant?: "outline" | "chip" | "plain";
  style?: React.CSSProperties;
}

/** Machine identity in mono with letter-spacing — plates, VINs, verification codes. */
export declare function Plate(props: PlateProps): React.ReactElement;
