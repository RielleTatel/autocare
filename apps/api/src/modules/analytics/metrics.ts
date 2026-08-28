/**
 * Admin dashboard arithmetic, kept pure so the money maths is testable without a
 * database. Everything is centavos as bigint — never floating point.
 */

export type BillingIntervalName = "MONTHLY" | "QUARTERLY" | "ANNUAL";

/**
 * Subscriptions that count as revenue-generating. A member five days late on a
 * card has not churned; excluding them would make MRR swing on payment timing
 * rather than on the business.
 */
export const CONTRACTED_STATUSES = ["ACTIVE", "GRACE", "PAST_DUE"] as const;

const MONTHS_PER_INTERVAL: Record<BillingIntervalName, bigint> = {
  MONTHLY: 1n,
  QUARTERLY: 3n,
  ANNUAL: 12n,
};

/** Divide, rounding half away from zero — bigint division truncates on its own. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

/** A plan's price expressed on a monthly basis, so intervals are comparable. */
export function normalisedMonthlyCentavos(priceCentavos: bigint, interval: BillingIntervalName): bigint {
  return divRound(priceCentavos, MONTHS_PER_INTERVAL[interval]);
}

export function mrrCentavos(subs: Array<{ priceCentavos: bigint; interval: BillingIntervalName }>): bigint {
  return subs.reduce((sum, s) => sum + normalisedMonthlyCentavos(s.priceCentavos, s.interval), 0n);
}

/**
 * Cancellations in the window over the population contracted when it opened.
 * A zero opening population yields 0 rather than NaN or Infinity — an empty book
 * has no churn to report.
 */
export function churnRate(cancelledInWindow: number, contractedAtWindowStart: number): number {
  if (contractedAtWindowStart <= 0) return 0;
  return cancelledInWindow / contractedAtWindowStart;
}
