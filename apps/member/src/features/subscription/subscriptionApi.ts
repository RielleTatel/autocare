import { ApiClient } from "@autocare/api-client";
import {
  CancellationQuote, EntitlementSummary, Invoice, InvoicePdfResponse,
  Plan, PaymentIntent, Subscription,
} from "@autocare/contracts";
import { newIdempotencyKey } from "./billingPreview";

export type SubscriptionWithPlan = Subscription & { plan: { id: string; code: string; name: string; priceCentavos: number; billingInterval: string; lockInMonths: number } };
export type UpgradeResult = Subscription & { proratedChargeCentavos: number };
export type DowngradeResult = Subscription & { effectiveAt: string };

/** Typed subscription/billing calls built on the shared `api` client, mirroring how the
 * vehicles feature calls `api.get/post/patch/del` directly rather than adding a bespoke
 * client — the one addition here is the `Idempotency-Key` header POST /subscriptions and
 * POST /payments/intents require, generated fresh per attempt. */
export function makeSubscriptionApi(api: ApiClient) {
  return {
    listPlans: () => api.get<Plan[]>("/plans"),

    createSubscription: (vehicleId: string, planId: string, paymentMethod: "E_PAYMENT" | "COD") =>
      api.post<Subscription>("/subscriptions", { vehicleId, planId, paymentMethod }, { "Idempotency-Key": newIdempotencyKey() }),

    listSubscriptions: () => api.get<SubscriptionWithPlan[]>("/subscriptions"),
    getSubscription: (id: string) => api.get<SubscriptionWithPlan>(`/subscriptions/${id}`),
    getEntitlements: (id: string) => api.get<EntitlementSummary[]>(`/subscriptions/${id}/entitlements`),
    upgrade: (id: string, planId: string) => api.post<UpgradeResult>(`/subscriptions/${id}/upgrade`, { planId }),
    downgrade: (id: string, planId: string) => api.post<DowngradeResult>(`/subscriptions/${id}/downgrade`, { planId }),
    cancellationQuote: (id: string) => api.get<CancellationQuote>(`/subscriptions/${id}/cancellation-quote`),
    cancel: (id: string, acceptEtf?: boolean) => api.post<Subscription>(`/subscriptions/${id}/cancel`, { acceptEtf }),

    createPaymentIntent: (invoiceId: string) =>
      api.post<PaymentIntent>("/payments/intents", { invoiceId }, { "Idempotency-Key": newIdempotencyKey() }),

    listInvoices: () => api.get<Invoice[]>("/invoices"),
    getInvoice: (id: string) => api.get<Invoice>(`/invoices/${id}`),
    getInvoicePdf: (id: string) => api.get<InvoicePdfResponse>(`/invoices/${id}/pdf`),
  };
}

export type SubscriptionApi = ReturnType<typeof makeSubscriptionApi>;
