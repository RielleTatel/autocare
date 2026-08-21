import { Injectable } from "@nestjs/common";
import { DomainError } from "../../common/errors/domain-error";
import { ProviderPort, PspEvent } from "./provider.port";
import { verifyHmacSignature } from "./webhook-signature";

const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

/**
 * Maps a PayMongo webhook payload (`data.attributes.type` + nested resource) to our PspEvent
 * shape. PayMongo's checkout/payment event envelope is roughly:
 * `{ data: { id, attributes: { type, data: { id, attributes: { amount, status, metadata } } } } }`.
 * Exported so the retry processor (webhooks.retryUnprocessed) can re-derive a PspEvent from a
 * stored `PspWebhookEvent.rawPayload` without re-verifying the (already-verified-once) signature.
 */
export function mapPaymongoEvent(raw: unknown): PspEvent {
  const data = (raw as any)?.data ?? {};
  const attrs = data.attributes ?? {};
  const resource = attrs.data ?? {};
  const resourceAttrs = resource.attributes ?? {};
  const type: string = attrs.type ?? "unknown";
  const succeeded = /\.(paid|succeeded)$/.test(type) || resourceAttrs.status === "paid";
  return {
    eventId: data.id,
    type,
    pspReference: resource.id ?? data.id,
    invoiceId: resourceAttrs.metadata?.invoiceId,
    amountCentavos: typeof resourceAttrs.amount === "number" ? resourceAttrs.amount : undefined,
    succeeded,
    raw,
  };
}

/** Real ProviderPort adapter against the PayMongo API. Selected unless NODE_ENV === "test"
 * (payments.module.ts uses FakeProviderAdapter in tests so no network call ever happens there). */
@Injectable()
export class PaymongoAdapter implements ProviderPort {
  private get secretKey(): string {
    const key = process.env.PAYMONGO_SECRET_KEY;
    if (!key) throw new Error("PAYMONGO_SECRET_KEY is not configured");
    return key;
  }

  private get webhookSecret(): string | undefined {
    return process.env.PAYMONGO_WEBHOOK_SECRET;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async createCheckout(invoice: { id: string; totalCentavos: number; description: string }) {
    const res = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ amount: invoice.totalCentavos, currency: "PHP", name: invoice.description, quantity: 1 }],
            payment_method_types: ["card", "gcash", "paymaya"],
            metadata: { invoiceId: invoice.id },
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`PayMongo createCheckout failed: ${res.status} ${await res.text()}`);
    }
    const body: any = await res.json();
    return {
      checkoutUrl: body.data.attributes.checkout_url as string,
      pspRef: body.data.id as string,
    };
  }

  verifyWebhook(rawBody: Buffer | string, signature: string): PspEvent {
    verifyHmacSignature(rawBody, signature, this.webhookSecret);
    const raw = JSON.parse((Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)).toString("utf8"));
    return mapPaymongoEvent(raw);
  }

  async refund(paymentId: string, amountCentavos: number) {
    const res = await fetch(`${PAYMONGO_API_BASE}/refunds`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ data: { attributes: { amount: amountCentavos, payment_id: paymentId, reason: "requested_by_customer" } } }),
    });
    if (!res.ok) {
      throw new DomainError("PAYMENT_FAILED", `PayMongo refund failed: ${res.status}`, 502);
    }
    const body: any = await res.json();
    return { refundRef: body.data.id as string };
  }
}
