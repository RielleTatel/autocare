import React from "react";

export interface IconProps {
  /** Lucide icon slug, e.g. "gauge", "car-front", "wrench", "triangle-alert". */
  name: string;
  /** Box in px. 16 inline, 20 default, 22 tab bar, 24 headers. */
  size?: number;
  /** Any CSS colour. Defaults to currentColor. */
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** Lucide glyph wrapper — a documented substitution, see readme ICONOGRAPHY. */
export declare function Icon(props: IconProps): React.ReactElement;
