export type InvoiceState =
  | "INVOICE_ISSUED"
  | "AWAITING_AUTO_CHARGE"
  | "AWAITING_CASH"
  | "RETRYING"
  | "GRACE"
  | "PAID"
  | "PAST_DUE"
  | "SUSPENDED";

export type InvoiceEvent =
  | { type: "ISSUED"; method: "E_PAYMENT" | "COD" }
  | { type: "CHARGE_SUCCEEDED" }
  | { type: "CHARGE_FAILED"; attempt: number }
  | { type: "CASH_RECORDED" }
  | { type: "DAY_ELAPSED"; daysSinceDue: number };

export function nextState(s: InvoiceState, e: InvoiceEvent): InvoiceState {
  switch (s) {
    case "INVOICE_ISSUED":
      return e.type === "ISSUED"
        ? e.method === "E_PAYMENT"
          ? "AWAITING_AUTO_CHARGE"
          : "AWAITING_CASH"
        : s;
    case "AWAITING_AUTO_CHARGE":
      if (e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "CHARGE_FAILED") return "RETRYING";
      return s;
    case "RETRYING":
      if (e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "CHARGE_FAILED" && e.attempt >= 3) return "PAST_DUE";
      return s;
    case "AWAITING_CASH":
      if (e.type === "CASH_RECORDED") return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 1) return "GRACE";
      return s;
    case "GRACE":
      if (e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED")
        return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 8) return "PAST_DUE";
      return s;
    case "PAST_DUE":
      if (e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED")
        return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 15) return "SUSPENDED";
      return s;
    case "SUSPENDED":
      return e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED"
        ? "PAID"
        : s;
    case "PAID":
      return s;
  }
}

export const RETRY_DAYS = [1, 3, 7] as const;

export type SubscriptionStatusValue =
  | "ACTIVE"
  | "GRACE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED";

export function subscriptionStatusFor(
  invoiceState: InvoiceState
): SubscriptionStatusValue {
  switch (invoiceState) {
    case "GRACE":
      return "GRACE";
    case "PAST_DUE":
      return "PAST_DUE";
    case "SUSPENDED":
      return "SUSPENDED";
    case "INVOICE_ISSUED":
    case "AWAITING_AUTO_CHARGE":
    case "AWAITING_CASH":
    case "RETRYING":
    case "PAID":
      return "ACTIVE";
  }
}
