import { Prisma } from "@prisma/client";

/** Explicit invoice origin recorded atomically with creation, without guessing from display text. */
export const MEMBER_CHECKOUT_ORIGIN = "MEMBER_CHECKOUT_INVOICE_CREATED";
export type CheckoutInvoiceKind = "INITIAL_SUBSCRIPTION" | "UPGRADE";
export function hasCheckoutOrigin(after: Prisma.JsonValue | null, subscriptionId: string | null): boolean {
  if (!after || typeof after !== "object" || Array.isArray(after)) return false;
  return after.subscriptionId === subscriptionId && ["INITIAL_SUBSCRIPTION", "UPGRADE"].includes(String(after.kind));
}

export function checkoutEligible(invoice: {
  totalCentavos: bigint | number;
  status: string;
  workOrderId?: string | null;
  subscription: { status: string; paymentMethod: string } | null;
}, hasOrigin: boolean): boolean {
  return hasOrigin && !invoice.workOrderId && Number(invoice.totalCentavos) > 0 &&
    Number.isSafeInteger(Number(invoice.totalCentavos)) &&
    ["AWAITING_AUTO_CHARGE", "RETRYING", "GRACE", "PAST_DUE", "SUSPENDED"].includes(invoice.status) &&
    !!invoice.subscription && invoice.subscription.status !== "CANCELLED" &&
    invoice.subscription.paymentMethod === "E_PAYMENT";
}
