import { ApiClient } from "@autocare/api-client";
import {
  CancellationQuote, EntitlementSummary, Invoice, InvoicePdfResponse,
  Plan, PaymentIntent, Subscription,
} from "@autocare/contracts";
import { newIdempotencyKey } from "./billingPreview";

export type SubscriptionWithPlan = Subscription & { pendingPlan?: { id: string; name: string } | null; plan: { id: string; code: string; name: string; priceCentavos: number; billingInterval: string; lockInMonths: number } };
export type SubscriptionCreation = Subscription & { invoiceId?: string };
export type UpgradeResult = Subscription & { proratedChargeCentavos: number; invoiceId?: string };
export type DowngradeResult = Subscription & { effectiveAt: string };

/** Typed subscription/billing calls built on the shared `api` client, mirroring how the
 * vehicles feature calls `api.get/post/patch/del` directly rather than adding a bespoke
 * client — the one addition here is the `Idempotency-Key` header POST /subscriptions and
 * POST /payments/intents require, generated fresh per attempt. */
export function makeSubscriptionApi(api: ApiClient) {
  return {
    listPlans: () => api.get<Plan[]>("/plans"),

    createSubscription: (vehicleId: string, planId: string, paymentMethod: "E_PAYMENT" | "COD", operationKey = newIdempotencyKey()) =>
      api.post<SubscriptionCreation>("/subscriptions", { vehicleId, planId, paymentMethod }, { "Idempotency-Key": operationKey }),

    listSubscriptions: () => api.get<SubscriptionWithPlan[]>("/subscriptions"),
    getSubscription: (id: string) => api.get<SubscriptionWithPlan>(`/subscriptions/${id}`),
    getEntitlements: (id: string) => api.get<EntitlementSummary[]>(`/subscriptions/${id}/entitlements`),
    upgrade: (id: string, planId: string, operationKey = newIdempotencyKey()) => api.post<UpgradeResult>(`/subscriptions/${id}/upgrade`, { planId }, { "Idempotency-Key": operationKey }),
    downgrade: (id: string, planId: string) => api.post<DowngradeResult>(`/subscriptions/${id}/downgrade`, { planId }),
    cancellationQuote: (id: string) => api.get<CancellationQuote>(`/subscriptions/${id}/cancellation-quote`),
    cancel: (id: string, acceptEtf?: boolean) => api.post<Subscription>(`/subscriptions/${id}/cancel`, { acceptEtf }),

    createPaymentIntent: (invoiceId: string, operationKey = newIdempotencyKey()) =>
      api.post<PaymentIntent>("/payments/intents", { invoiceId }, { "Idempotency-Key": operationKey }),

    listInvoices: () => api.get<Invoice[]>("/invoices"),
    getInvoice: (id: string) => api.get<Invoice>(`/invoices/${id}`),
    getInvoicePdf: (id: string) => api.get<InvoicePdfResponse>(`/invoices/${id}/pdf`),
  };
}

export type SubscriptionApi = ReturnType<typeof makeSubscriptionApi>;
