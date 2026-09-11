import React from "react";
import type { AttentionSeverity } from "./AttentionItemRow";

export interface AttentionItem {
  id: string;
  title: string;
  body: string;
  plate?: string;
  severity: AttentionSeverity;
}

export interface AttentionCardProps {
  /** Pre-sorted, most severe first. Empty array renders the positive empty state. */
  items?: AttentionItem[];
  onSeeAll?: () => void;
  onPressItem?: (item: AttentionItem) => void;
  style?: React.CSSProperties;
}

/**
 * The "What Needs Attention" summary — the top of the member home screen (M-10).
 * @startingPoint section="Attention" subtitle="Home summary of open items" viewport="700x260"
 */
export declare function AttentionCard(props: AttentionCardProps): React.ReactElement;
