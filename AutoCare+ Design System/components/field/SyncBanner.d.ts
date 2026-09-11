import React from "react";

export interface SyncBannerProps {
  /** Items in the offline outbox. 0 renders nothing. */
  pendingCount?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Navy offline-sync banner, pinned to the top of every field screen. */
export declare function SyncBanner(props: SyncBannerProps): React.ReactElement | null;
