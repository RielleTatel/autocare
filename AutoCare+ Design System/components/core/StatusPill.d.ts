import React from "react";

export interface StatusPillProps {
  children?: React.ReactNode;
  /** neutral = not started · info = in motion · success = settled · warn = needs someone · danger = stopped · solid/solidDeep = on-chrome */
  tone?: "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";
  style?: React.CSSProperties;
}

/** Mono-caps lifecycle pill — work orders, invoices, trips, roadside. */
export declare function StatusPill(props: StatusPillProps): React.ReactElement;
