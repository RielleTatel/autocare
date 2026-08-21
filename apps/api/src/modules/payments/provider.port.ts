/**
 * Port for the e-payment provider (PayMongo in prod, an in-memory fake in tests — selected by
 * NODE_ENV in payments.module.ts, following the STORAGE_PORT pattern in users.module.ts).
 * Card data never touches our servers: createCheckout returns an aggregator-hosted checkout URL
 * (FR-087/NFR-020).
 */
export const PROVIDER_PORT = Symbol("PROVIDER_PORT");

export interface PspEvent {
  eventId: string;
  type: string;
  pspReference: string;
  invoiceId?: string;
  amountCentavos?: number;
  succeeded: boolean;
  raw: unknown;
}

export interface ProviderPort {
  createCheckout(invoice: { id: string; totalCentavos: number; description: string }): Promise<{
    checkoutUrl: string;
    pspRef: string;
  }>;
  /** Verifies the HMAC signature over the RAW body and maps the payload to a PspEvent. Throws (WEBHOOK_SIGNATURE_INVALID, 401) on a bad/missing signature. */
  verifyWebhook(rawBody: Buffer | string, signature: string): PspEvent;
  refund(paymentId: string, amountCentavos: number): Promise<{ refundRef: string }>;
}
