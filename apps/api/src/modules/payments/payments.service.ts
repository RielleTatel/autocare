import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { PROVIDER_PORT, ProviderPort, VerifiedPspEvent } from "./provider.port";
import { InvoiceState, nextState, subscriptionStatusFor } from "./invoice-lifecycle";
import { checkoutEligible, hasCheckoutOrigin, MEMBER_CHECKOUT_ORIGIN } from "./checkout-policy";

class ConcurrentInvoiceTransition extends Error {}

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private vehicles: VehiclesService,
    @Inject(PROVIDER_PORT) private provider: ProviderPort,
  ) {}

  /** POST /payments/intents — a member-initiated intent to pay an invoice by e-payment (API §9.1). */
  async createIntent(user: AbilityUser, invoiceId: string) {
    const invoice = await this.loadInvoiceForUser(user, invoiceId);
    if (invoice.status === "PAID") {
      throw new DomainError("INVOICE_ALREADY_PAID", "This invoice is already settled", 409);
    }
    const origin = await this.prisma.auditLog.findFirst({
      where: { action: MEMBER_CHECKOUT_ORIGIN, entityType: "Invoice", entityId: invoice.id },
      select: { after: true },
    });
    if (!checkoutEligible(invoice, hasCheckoutOrigin(origin?.after ?? null, invoice.subscriptionId))) {
      throw new DomainError("PAYMENT_FAILED", "This invoice is not eligible for subscription test-card checkout", 422);
    }
    const { checkoutUrl } = await this.provider.createCheckout({
      id: invoice.id,
      totalCentavos: Number(invoice.totalCentavos),
      description: `Invoice ${invoice.number}`,
    });
    return { checkoutUrl, invoiceId: invoice.id, sandbox: true as const };
  }

  /**
   * Called by the billing job (Task 8) to auto-charge an AWAITING_AUTO_CHARGE/RETRYING invoice.
   * Records a failed attempt (chargeAttempts++/firstFailedAt) if even *creating* the checkout
   * fails; the success/failure of the charge itself is only known later, via the webhook.
   */
  async autoCharge(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    try {
      return await this.provider.createCheckout({
        id: invoice.id,
        totalCentavos: Number(invoice.totalCentavos),
        description: `Invoice ${invoice.number}`,
      });
    } catch (e) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { chargeAttempts: { increment: 1 }, firstFailedAt: invoice.firstFailedAt ?? new Date() },
      });
      throw e;
    }
  }

  /**
   * Exactly-once webhook flow (Ruling — webhooks HMAC-verified, persisted raw BEFORE
   * processing, processed once via the (provider, event_id) unique):
   *   1. verifyWebhook (throws 401 on bad signature) — done by the caller before this is invoked.
   *   2. Persist PspWebhookEvent; completed replays are no-ops, unprocessed replays retry.
   *   3. Process in a transaction, retrying a lost invoice-state race without dropping success.
   */
  async handleWebhook(event: VerifiedPspEvent): Promise<{ alreadyProcessed: boolean }> {
    let webhookEventId: string;
    try {
      const row = await this.prisma.pspWebhookEvent.create({
        data: { provider: "paymongo", eventId: event.eventId, rawPayload: event.raw as Prisma.InputJsonValue },
      });
      webhookEventId = row.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existing = await this.prisma.pspWebhookEvent.findUnique({
          where: { provider_eventId: { provider: "paymongo", eventId: event.eventId } },
        });
        if (!existing) throw e;
        // A previous attempt may have persisted the verified payload and then failed.
        // Retry that original payload rather than discarding the provider's redelivery.
        if (!existing.processedAt) await this.processEvent(this.provider.mapEvent(existing.rawPayload), existing.id);
        return { alreadyProcessed: true };
      }
      throw e;
    }

    await this.processEvent(event, webhookEventId);
    return { alreadyProcessed: false };
  }

  /** Advances Payment/Invoice/Subscription for one verified PspEvent, and marks the webhook row processed. */
  async processEvent(delivery: VerifiedPspEvent, webhookEventId: string): Promise<void> {
    const event = "resolvePayment" in delivery ? await delivery.resolvePayment() : delivery;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const invoice = event.invoiceId
            ? await tx.invoice.findUnique({ where: { id: event.invoiceId } })
            : null;

          if (!invoice) {
            // Event we can't reconcile against an invoice (e.g. unrelated PayMongo event type) —
            // still mark it processed so retryUnprocessed doesn't keep picking it up.
            await tx.pspWebhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
            return;
          }

          if (
            event.succeeded &&
            event.amountCentavos !== undefined &&
            (!Number.isSafeInteger(event.amountCentavos) ||
              event.amountCentavos <= 0 ||
              BigInt(event.amountCentavos) !== invoice.totalCentavos)
          ) {
            throw new DomainError("PAYMENT_FAILED", "Payment amount does not match the invoice", 422);
          }

          const nextAttempt = invoice.chargeAttempts + 1;
          const nextInvoiceState: InvoiceState = nextState(
            invoice.status as InvoiceState,
            event.succeeded ? { type: "CHARGE_SUCCEEDED" } : { type: "CHARGE_FAILED", attempt: nextAttempt },
          );

          if (nextInvoiceState === invoice.status) {
            // No-op — e.g. a duplicate SUCCEEDED webhook (distinct eventId) for an invoice
            // already PAID, or a charge-failed event that can't move this state further.
            // Mirrors the cash path's guard (cash.service.ts recordCashPayment): don't mint a
            // second Payment row, just mark the webhook event processed.
            await tx.pspWebhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
            return;
          }

          const advanced = await tx.invoice.updateMany({
            where: { id: invoice.id, status: invoice.status, chargeAttempts: invoice.chargeAttempts },
            data: {
              status: nextInvoiceState,
              chargeAttempts: event.succeeded ? invoice.chargeAttempts : nextAttempt,
              firstFailedAt: !event.succeeded ? invoice.firstFailedAt ?? new Date() : invoice.firstFailedAt,
            },
          });
          if (advanced.count !== 1) throw new ConcurrentInvoiceTransition();

          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              method: event.method ?? "CARD",
              amountCentavos: BigInt(event.amountCentavos ?? Number(invoice.totalCentavos)),
              status: event.succeeded ? "SUCCEEDED" : "FAILED",
              pspReference: event.pspReference,
              clientUuid: event.eventId,
            },
          });

          if (invoice.subscriptionId) {
            await tx.subscription.updateMany({
              where: { id: invoice.subscriptionId, status: { not: "CANCELLED" } },
              data: { status: subscriptionStatusFor(nextInvoiceState) },
            });
          }

          await tx.pspWebhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
        });
        return;
      } catch (error) {
        if (!(error instanceof ConcurrentInvoiceTransition)) throw error;
      }
    }
    // Leave the verified event unprocessed so provider redelivery or the worker can retry.
    throw new DomainError("PAYMENT_FAILED", "Invoice changed while processing payment; retry the event", 409);
  }

  private async loadInvoiceForUser(user: AbilityUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);
    if (!invoice.subscription) throw new DomainError("FORBIDDEN_ROLE", "This invoice has no supported subscription", 403);
    await this.vehicles.findForUser(user, invoice.subscription.vehicleId, "update");
    return invoice;
  }
}
