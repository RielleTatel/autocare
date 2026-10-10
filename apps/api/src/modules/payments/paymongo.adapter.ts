import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { DomainError } from "../../common/errors/domain-error";
import { ProviderPort, PspEvent } from "./provider.port";
import { verifyPaymongoSignature } from "./webhook-signature";

const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

const eventSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      type: z.string().min(1),
      livemode: z.literal(false),
      data: z.unknown().optional(),
    }),
  }),
});

const invoiceMetadataSchema = z.object({ invoiceId: z.string().min(1).optional() });
const paymentSchema = z.object({
  id: z.string().startsWith("pay_").min(5),
  attributes: z.object({
    amount: z.number().int().positive().safe(),
    currency: z.literal("PHP"),
    status: z.enum(["paid", "failed"]),
    livemode: z.literal(false).optional(),
    source: z.object({ type: z.enum(["card", "gcash", "paymaya"]) }),
    metadata: invoiceMetadataSchema.nullish(),
  }),
});
const checkoutSchema = z.object({
  id: z.string().startsWith("cs_").min(4),
  attributes: z.object({
    livemode: z.literal(false).optional(),
    metadata: invoiceMetadataSchema.nullish(),
    reference_number: z.string().min(1).nullish(),
    payments: z.array(z.unknown()),
  }),
});
const checkoutResponseSchema = z.object({
  data: z.object({
    id: z.string().startsWith("cs_").min(4),
    attributes: z.object({
      livemode: z.literal(false),
      checkout_url: z.string().url().refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && url.hostname === "checkout.paymongo.com" && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    }),
  }),
});

function invalidEvent(): DomainError {
  return new DomainError("PAYMENT_FAILED", "Invalid PayMongo test payment event", 400);
}

function checkoutReturnUrl(name: "PAYMONGO_SUCCESS_URL" | "PAYMONGO_CANCEL_URL"): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const parsed = z.string().url().startsWith("https://").safeParse(value);
  if (!parsed.success) throw new DomainError("PAYMENT_FAILED", `${name} must be an HTTPS URL`, 503);
  return parsed.data;
}

/**
 * Maps the standard PayMongo event envelope to our PspEvent. Checkout events wrap a session;
 * its payments[] contains the settled payment's pay_ ID, amount, and source type. Session
 * status is not payment status. Unrelated events have no invoice linkage and are ignored.
 * Exported (and exposed as `PaymongoAdapter.mapEvent`, part of ProviderPort) so the retry
 * processor (webhooks.retryUnprocessed) can re-derive a PspEvent from a stored
 * `PspWebhookEvent.rawPayload` without re-verifying the (already-verified-once) signature — via
 * the injected PROVIDER_PORT, never by importing this concrete adapter directly.
 */
export function mapPaymongoEvent(raw: unknown): PspEvent {
  const envelope = eventSchema.safeParse(raw);
  if (!envelope.success) throw invalidEvent();
  const { id: eventId, attributes: attrs } = envelope.data.data;
  const type = attrs.type;
  if (!["checkout_session.payment.paid", "payment.paid", "payment.failed"].includes(type)) {
    return { eventId, type, pspReference: eventId, succeeded: false, raw };
  }

  let paymentResource: unknown = attrs.data;
  let invoiceId: string | undefined;
  if (type === "checkout_session.payment.paid") {
    const session = checkoutSchema.safeParse(attrs.data);
    if (!session.success) throw invalidEvent();
    invoiceId = session.data.attributes.metadata?.invoiceId ?? session.data.attributes.reference_number ?? undefined;
    const paidPayments = session.data.attributes.payments.filter((item) =>
      (item as { attributes?: { status?: string } } | null)?.attributes?.status === "paid",
    );
    if (paidPayments.length !== 1) throw invalidEvent();
    paymentResource = paidPayments[0];
  }

  const parsedPayment = paymentSchema.safeParse(paymentResource);
  if (!parsedPayment.success) throw invalidEvent();
  const payment = parsedPayment.data;
  const succeeded = type !== "payment.failed";
  if (payment.attributes.status !== (succeeded ? "paid" : "failed")) throw invalidEvent();
  const methods = { card: "CARD", gcash: "GCASH", paymaya: "MAYA" } as const;
  return {
    eventId,
    type,
    pspReference: payment.id,
    invoiceId: invoiceId ?? payment.attributes.metadata?.invoiceId,
    amountCentavos: payment.attributes.amount,
    method: methods[payment.attributes.source.type],
    succeeded,
    raw,
  };
}

/** Test-mode PayMongo API adapter. Selected unless NODE_ENV === "test"
 * (payments.module.ts uses FakeProviderAdapter in tests so no network call ever happens there). */
@Injectable()
export class PaymongoAdapter implements ProviderPort {
  private get secretKey(): string {
    const key = process.env.PAYMONGO_SECRET_KEY;
    if (!key?.startsWith("sk_test_")) {
      throw new DomainError("PAYMENT_FAILED", "A PayMongo test secret key is required", 503);
    }
    return key;
  }

  private get webhookSecret(): string | undefined {
    return process.env.PAYMONGO_WEBHOOK_SECRET;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async createCheckout(invoice: { id: string; totalCentavos: number; description: string }) {
    if (!Number.isSafeInteger(invoice.totalCentavos) || invoice.totalCentavos <= 0) {
      throw new DomainError("PAYMENT_FAILED", "Checkout amount must be a positive integer in centavos", 400);
    }
    const successUrl = checkoutReturnUrl("PAYMONGO_SUCCESS_URL");
    const cancelUrl = checkoutReturnUrl("PAYMONGO_CANCEL_URL");
    if (Boolean(successUrl) !== Boolean(cancelUrl)) {
      throw new DomainError("PAYMENT_FAILED", "Configure both PayMongo checkout return URLs", 503);
    }
    const res = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ amount: invoice.totalCentavos, currency: "PHP", name: invoice.description, quantity: 1 }],
            payment_method_types: ["card", "gcash", "paymaya"],
            metadata: { invoiceId: invoice.id },
            reference_number: invoice.id,
            ...(successUrl ? { success_url: successUrl, cancel_url: cancelUrl } : {}),
          },
        },
      }),
    });
    if (!res.ok) {
      throw new DomainError("PAYMENT_FAILED", `PayMongo checkout failed: ${res.status}`, 502);
    }
    const body = checkoutResponseSchema.safeParse(await res.json());
    if (!body.success) throw new DomainError("PAYMENT_FAILED", "Invalid PayMongo test checkout response", 502);
    return {
      checkoutUrl: body.data.data.attributes.checkout_url,
      pspRef: body.data.data.id,
    };
  }

  verifyWebhook(rawBody: Buffer | string, signature: string): PspEvent {
    verifyPaymongoSignature(rawBody, signature, this.webhookSecret);
    let raw: unknown;
    try {
      raw = JSON.parse((Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)).toString("utf8"));
    } catch {
      throw invalidEvent();
    }
    return this.mapEvent(raw);
  }

  mapEvent(raw: unknown): PspEvent {
    return mapPaymongoEvent(raw);
  }

  async refund(paymentId: string, amountCentavos: number) {
    const res = await fetch(`${PAYMONGO_API_BASE}/refunds`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ data: { attributes: { amount: amountCentavos, payment_id: paymentId, reason: "requested_by_customer" } } }),
    });
    if (!res.ok) {
      throw new DomainError("PAYMENT_FAILED", `PayMongo refund failed: ${res.status}`, 502);
    }
    const body: any = await res.json();
    return { refundRef: body.data.id as string };
  }
}
