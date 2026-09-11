import React from "react";

export interface PlanCardProps {
  name: string;
  /** Pre-formatted price string, e.g. "₱1,499". Centavos are formatted upstream. */
  price: string;
  interval?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  /** 0 renders "No lock-in" — stated plainly, never hidden. */
  lockInMonths?: number;
  /** Every entitlement, spelled out. No "and more". */
  inclusions?: string[];
  selected?: boolean;
  actionLabel?: string;
  onSelect?: () => void;
  style?: React.CSSProperties;
}

/**
 * Membership plan card for plan selection and upgrade/downgrade (M-08, M-29).
 * @startingPoint section="Subscription" subtitle="Membership plan comparison card" viewport="700x340"
 */
export declare function PlanCard(props: PlanCardProps): React.ReactElement;
