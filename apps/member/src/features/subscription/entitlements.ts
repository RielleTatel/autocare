import { EntitlementSummary } from "@autocare/contracts";

const LABELS: Record<string, string> = {
  INSPECTION: "inspections",
  PICKUP: "pickups",
  ROADSIDE: "roadside assists",
  OIL_CHANGE: "oil changes",
  TIRE_ROTATION: "tire rotations",
};

/** "1 of 2 inspections left" style summary for an entitlement gauge (M-28). */
export function entitlementLabel(e: EntitlementSummary): string {
  const noun = LABELS[e.entitlementType] ?? e.entitlementType.toLowerCase().replace(/_/g, " ");
  return `${e.remaining} of ${e.quantityPerCycle} ${noun} left`;
}

/** Fraction of the cycle's quota remaining, clamped to [0, 1] — for a progress-bar gauge width.
 * Zero-quota entitlements (quantityPerCycle 0) read as fully "used" (0) rather than dividing by zero. */
export function entitlementFraction(e: EntitlementSummary): number {
  if (e.quantityPerCycle <= 0) return 0;
  return Math.max(0, Math.min(1, e.remaining / e.quantityPerCycle));
}

/** Days remaining until the lock-in period ends (M-28 lock-in countdown). Never negative. */
export function lockInDaysRemaining(lockInEndsAt: string, now: Date = new Date()): number {
  const ms = new Date(lockInEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export type SubscriptionStatus = "ACTIVE" | "GRACE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

const STATUS_MESSAGES: Record<SubscriptionStatus, string> = {
  ACTIVE: "Your subscription is active.",
  GRACE: "Payment is overdue — you're in a grace period. Pay soon to avoid suspension.",
  PAST_DUE: "Payment is past due. Please settle your invoice to avoid suspension.",
  SUSPENDED: "Your subscription is suspended due to non-payment. Pay your outstanding invoice to restore service.",
  CANCELLED: "This subscription has been cancelled.",
};

export function statusMessage(status: SubscriptionStatus): string {
  return STATUS_MESSAGES[status] ?? "";
}
