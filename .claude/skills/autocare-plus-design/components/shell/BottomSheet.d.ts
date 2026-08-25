import React from "react";

export interface BottomSheetProps {
  open?: boolean;
  title?: string;
  children?: React.ReactNode;
  /** Omit to render a non-dismissible sheet. */
  onClose?: () => void;
  closeLabel?: string;
  style?: React.CSSProperties;
}

export interface MeasuredRowProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Bottom-anchored progressive-disclosure sheet over a scrim. */
export declare function BottomSheet(props: BottomSheetProps): React.ReactElement | null;
/** Sunken measured-value readout for use inside a sheet. */
export declare function MeasuredRow(props: MeasuredRowProps): React.ReactElement;
