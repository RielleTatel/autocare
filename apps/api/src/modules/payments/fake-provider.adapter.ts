import { randomUUID } from "crypto";
import { ProviderPort, PspEvent } from "./provider.port";
import { verifyHmacSignature } from "./webhook-signature";

/**
 * Deterministic test secret for the fake adapter — tests import this to sign fixture payloads
 * with the same HMAC scheme `verifyHmacSignature` checks against.
 */
export const FAKE_WEBHOOK_SECRET = "test-webhook-secret";

/** Fixture payload shape the fake adapter's webhooks expect — deliberately flat/simple, unlike
 * PayMongo's real nested `data.attributes...` shape, so e2e tests can build fixtures directly. */
export interface FakePspPayload {
  eventId: string;
  type: string;
  pspReference: string;
  invoiceId?: string;
  amountCentavos?: number;
  succeeded: boolean;
}

/**
 * In-memory test double for ProviderPort — selected instead of PaymongoAdapter whenever
 * NODE_ENV === "test" (payments.module.ts) so unit/e2e tests never hit the network.
 */
export class FakeProviderAdapter implements ProviderPort {
  async createCheckout(invoice: { id: string; totalCentavos: number; description: string }) {
    return { checkoutUrl: `https://fake-checkout.test/${invoice.id}`, pspRef: `fake_${randomUUID()}` };
  }

  verifyWebhook(rawBody: Buffer | string, signature: string): PspEvent {
    verifyHmacSignature(rawBody, signature, FAKE_WEBHOOK_SECRET);
    const raw = JSON.parse((Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)).toString("utf8"));
    return this.mapEvent(raw);
  }

  mapEvent(raw: unknown): PspEvent {
    const parsed = raw as FakePspPayload;
    return {
      eventId: parsed.eventId,
      type: parsed.type,
      pspReference: parsed.pspReference,
      invoiceId: parsed.invoiceId,
      amountCentavos: parsed.amountCentavos,
      succeeded: parsed.succeeded,
      raw: parsed,
    };
  }

  async refund(paymentId: string, amountCentavos: number) {
    return { refundRef: `fake_refund_${paymentId}_${amountCentavos}` };
  }
}
