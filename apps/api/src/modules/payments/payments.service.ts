import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { PROVIDER_PORT, ProviderPort, PspEvent } from "./provider.port";
import { InvoiceState, nextState, subscriptionStatusFor } from "./invoice-lifecycle";

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
    const { checkoutUrl } = await this.provider.createCheckout({
      id: invoice.id,
      totalCentavos: Number(invoice.totalCentavos),
      description: `Invoice ${invoice.number}`,
    });
    return { checkoutUrl };
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
   *   2. Insert PspWebhookEvent; a unique-constraint conflict means "already seen" -> no-op.
   *   3. Otherwise, process the event in a transaction.
   */
  async handleWebhook(event: PspEvent): Promise<{ alreadyProcessed: boolean }> {
    let webhookEventId: string;
    try {
      const row = await this.prisma.pspWebhookEvent.create({
        data: { provider: "paymongo", eventId: event.eventId, rawPayload: event.raw as Prisma.InputJsonValue },
      });
      webhookEventId = row.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { alreadyProcessed: true }; // idempotent replay — already inserted (and processed) before
      }
      throw e;
    }

    await this.processEvent(event, webhookEventId);
    return { alreadyProcessed: false };
  }

  /** Advances Payment/Invoice/Subscription for one verified PspEvent, and marks the webhook row processed. */
  async processEvent(event: PspEvent, webhookEventId: string): Promise<void> {
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

      const nextAttempt = invoice.chargeAttempts + 1;
      const nextInvoiceState: InvoiceState = nextState(
        invoice.status as InvoiceState,
        event.succeeded ? { type: "CHARGE_SUCCEEDED" } : { type: "CHARGE_FAILED", attempt: nextAttempt },
      );

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: "CARD",
          amountCentavos: BigInt(event.amountCentavos ?? Number(invoice.totalCentavos)),
          status: event.succeeded ? "SUCCEEDED" : "FAILED",
          pspReference: event.pspReference,
          clientUuid: event.eventId,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: nextInvoiceState,
          chargeAttempts: event.succeeded ? invoice.chargeAttempts : nextAttempt,
          firstFailedAt: !event.succeeded ? invoice.firstFailedAt ?? new Date() : invoice.firstFailedAt,
        },
      });

      if (invoice.subscriptionId) {
        await tx.subscription.update({
          where: { id: invoice.subscriptionId },
          data: { status: subscriptionStatusFor(nextInvoiceState) },
        });
      }

      await tx.pspWebhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
    });
  }

  private async loadInvoiceForUser(user: AbilityUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);
    if (invoice.subscription) {
      await this.vehicles.findForUser(user, invoice.subscription.vehicleId, "read");
    }
    return invoice;
  }
}
