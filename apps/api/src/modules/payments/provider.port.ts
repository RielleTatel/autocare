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
  /**
   * Maps an already-persisted, already-verified webhook payload (PspWebhookEvent.rawPayload)
   * back to a PspEvent, WITHOUT re-checking any signature. Used by the retry path
   * (webhooks.processor.ts) to reprocess unprocessed rows — going through the port (rather than
   * importing a concrete adapter's mapper) keeps the retry path provider-agnostic: it uses
   * whichever adapter is env-selected (fake in tests, real PayMongo in prod), matching the
   * payload shape that adapter actually produced.
   */
  mapEvent(raw: unknown): PspEvent;
  refund(paymentId: string, amountCentavos: number): Promise<{ refundRef: string }>;
}
