import { formatCentavos } from "./formatCentavos";

/** M-29 upgrade preview: the API applies the plan change immediately and returns
 * `proratedChargeCentavos` on the upgrade response — this just phrases it for display. */
export function upgradePreviewText(proratedChargeCentavos: number): string {
  return `You'll be charged ${formatCentavos(proratedChargeCentavos)} now (pro-rated for the rest of this billing cycle).`;
}

/** M-29 downgrade preview: the API defers the plan change to `effectiveAt` (currentPeriodEnd). */
export function downgradePreviewText(effectiveAt: string): string {
  const date = new Date(effectiveAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  return `Your plan will switch on your next billing date, ${date}. No charge today.`;
}

/** M-30 cancellation ETF display (NFR-030: plain, no dark patterns — the amount and the
 * lock-in end date, stated directly). */
export function etfSummaryText(etfCentavos: number, lockInEndsAt: string): string {
  const date = new Date(lockInEndsAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  if (etfCentavos <= 0) {
    return "You're outside the lock-in period — cancelling now has no early termination fee.";
  }
  return `Cancelling now, before your lock-in ends on ${date}, charges an early termination fee of ${formatCentavos(etfCentavos)}.`;
}

/** Whether the cancellation flow must show the "I accept the ETF" checkbox — only when
 * cancelling would actually incur a fee (inside lock-in). */
export function requiresEtfAcceptance(etfCentavos: number): boolean {
  return etfCentavos > 0;
}

/** A fresh Idempotency-Key for one POST /subscriptions or /payments/intents attempt.
 * Prefers the platform's crypto.randomUUID (available in Hermes/RN 0.74+ and in Jest's
 * Node environment); falls back to a manual v4-shaped random string if unavailable. */
export function newIdempotencyKey(): string {
  const c: any = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  let uuid = "";
  for (const ch of "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx") {
    if (ch === "x") uuid += Math.floor(Math.random() * 16).toString(16);
    else if (ch === "y") uuid += ((Math.random() * 4) | 8).toString(16);
    else uuid += ch;
  }
  return uuid;
}
