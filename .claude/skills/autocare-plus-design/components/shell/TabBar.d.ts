import React from "react";

export interface TabBarTab {
  key: string;
  label: string;
  /** 22×22 icon element — a Lucide SVG in the UI kits. */
  icon?: React.ReactNode;
}

export interface TabBarProps {
  tabs?: TabBarTab[];
  active?: string;
  onChange?: (key: string) => void;
  style?: React.CSSProperties;
}

/** Member app bottom tab bar — Home · My Vehicles · Bookings · Account. */
export declare function TabBar(props: TabBarProps): React.ReactElement;
