import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { EntitlementService } from "../entitlements/entitlement.service";
import { InvoiceState, RETRY_DAYS, nextState, subscriptionStatusFor } from "../payments/invoice-lifecycle";
import { addMonthsManila, manilaDayIndex, INTERVAL_MONTHS } from "../subscriptions/billing-math";
import { nextInvoiceNumber, withInvoiceNumberRetry } from "../subscriptions/invoice-numbering";
import { CLOCK, Clock } from "../../common/clock/clock";

/**
 * Billing job LOGIC (Task 8, §7.8) — the 5 scheduled processors' actual work, kept out of the
 * BullMQ `@Processor` (billing.processor.ts) so it is directly unit/integration-testable with an
 * injected clock, independent of any queue/worker plumbing.
 *
 * Every method reads "today" from the injected `CLOCK` — never `new Date()` — so tests can drive
 * a deterministic multi-day timeline by swapping in a fake clock. Every method is idempotent:
 * re-running it for the same simulated day produces the same end state, not a double-advance.
 */
@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private entitlements: EntitlementService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  /**
   * `billing.issueInvoices` (daily 01:00). For every non-cancelled subscription whose
   * `currentPeriodEnd` falls on today (Manila), issues the next period's Invoice + InvoiceItem
   * and advances `currentPeriodStart/End`. Idempotent: guarded on an existing invoice with
   * `dueDate === currentPeriodEnd` for the subscription — re-running the same day is a no-op for
   * subscriptions already issued.
   */
  async issueInvoices(): Promise<{ issued: number }> {
    const todayIdx = manilaDayIndex(this.clock.now());
    const subs = await this.prisma.subscription.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { plan: true },
    });

    let issued = 0;
    for (const sub of subs) {
      if (manilaDayIndex(sub.currentPeriodEnd) !== todayIdx) continue;

      const newPeriodStart = sub.currentPeriodEnd;
      const existing = await this.prisma.invoice.findFirst({
        where: { subscriptionId: sub.id, dueDate: newPeriodStart },
      });
      if (existing) continue; // already issued for this period — re-run same day is a no-op

      const newPeriodEnd = addMonthsManila(newPeriodStart, INTERVAL_MONTHS[sub.plan.billingInterval] ?? 1);
      const status = nextState("INVOICE_ISSUED", { type: "ISSUED", method: sub.paymentMethod });

      await withInvoiceNumberRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const number = await nextInvoiceNumber(tx);
          await tx.invoice.create({
            data: {
              subscriptionId: sub.id,
              number,
              totalCentavos: sub.plan.priceCentavos,
              status,
              dueDate: newPeriodStart,
              items: {
                create: [{ description: `${sub.plan.name} (${sub.plan.billingInterval})`, qty: 1, unitPriceCentavos: sub.plan.priceCentavos }],
              },
            },
          });
          await tx.subscription.update({
            where: { id: sub.id },
            data: { currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodEnd },
          });
        }),
      );
      issued += 1;
    }
    return { issued };
  }

  /**
   * `billing.autoCharge` (daily 02:00). For E_PAYMENT invoices sitting in AWAITING_AUTO_CHARGE,
   * calls `PaymentsService.autoCharge`. Success (checkout created OK) leaves the invoice's status
   * untouched — the actual charge outcome is only known later via the webhook. A failure to even
   * create the checkout (PaymentsService.autoCharge throws, having already recorded
   * chargeAttempts/firstFailedAt) fires CHARGE_FAILED here, moving the invoice to RETRYING.
   * Naturally idempotent per (invoice, date): a failure moves the invoice out of
   * AWAITING_AUTO_CHARGE, so re-running the same day no longer selects it.
   */
  async autoCharge(): Promise<{ attempted: number }> {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: "AWAITING_AUTO_CHARGE", subscription: { paymentMethod: "E_PAYMENT" } },
    });

    let attempted = 0;
    for (const inv of invoices) {
      attempted += 1;
      try {
        await this.payments.autoCharge(inv.id);
      } catch {
        await this.applyChargeFailed(inv.id, inv.subscriptionId, "AWAITING_AUTO_CHARGE");
      }
    }
    return { attempted };
  }

  /**
   * `billing.retryFailed` (daily 03:00). For invoices in RETRYING, retries `autoCharge` only on
   * days matching `RETRY_DAYS` (1, 3, 7) since `firstFailedAt` — and only once per matching day,
   * even if this job runs more than once that day: `retriesDoneSoFar` (chargeAttempts - 1, since
   * the initial failure that put the invoice into RETRYING already counted as attempt 1) is
   * compared against how many RETRY_DAYS have elapsed so far; a retry only fires when fewer
   * retries have happened than are due. After the 3rd total failure the state machine moves the
   * invoice to PAST_DUE (nextState's attempt >= 3 rule).
   */
  async retryFailed(): Promise<{ retried: number }> {
    const todayIdx = manilaDayIndex(this.clock.now());
    const invoices = await this.prisma.invoice.findMany({ where: { status: "RETRYING" } });

    let retried = 0;
    for (const inv of invoices) {
      if (!inv.firstFailedAt) continue;
      const daysSinceDue = todayIdx - manilaDayIndex(inv.firstFailedAt);
      if (!(RETRY_DAYS as readonly number[]).includes(daysSinceDue)) continue;

      const retriesDoneSoFar = inv.chargeAttempts - 1;
      const retriesDueByToday = RETRY_DAYS.filter((d) => d <= daysSinceDue).length;
      if (retriesDoneSoFar >= retriesDueByToday) continue; // already retried for this day

      retried += 1;
      try {
        await this.payments.autoCharge(inv.id);
      } catch {
        await this.applyChargeFailed(inv.id, inv.subscriptionId, "RETRYING");
      }
    }
    return { retried };
  }

  /** Shared by autoCharge/retryFailed: fires CHARGE_FAILED off the invoice's freshly-persisted chargeAttempts (already incremented by PaymentsService.autoCharge's catch block) and mirrors the resulting invoice/subscription status. */
  private async applyChargeFailed(invoiceId: string, subscriptionId: string | null, fromState: InvoiceState): Promise<void> {
    const updated = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const next = nextState(fromState, { type: "CHARGE_FAILED", attempt: updated.chargeAttempts });
    if (next === updated.status) return;
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: next } });
    if (subscriptionId) {
      await this.prisma.subscription.update({ where: { id: subscriptionId }, data: { status: subscriptionStatusFor(next) } });
    }
  }

  /**
   * `subscription.evaluateStates` (daily 04:00). Three responsibilities:
   *  1. COD/grace-path invoices (AWAITING_CASH/GRACE/PAST_DUE) fire DAY_ELAPSED with the exact
   *     day count since `dueDate` — nextState's threshold (`>=`) checks make repeated same-day
   *     calls idempotent (same daysSinceDue always yields the same resulting state).
   *  2. Flagged downgrades (`pendingPlanId`) are applied once `currentPeriodEnd` is reached.
   *  3. Deferred cancellations (`cancelRequestedAt` set) are finalized to CANCELLED once
   *     `currentPeriodEnd` is reached.
   * All three are naturally idempotent: (1) is a pure function of the current day count, and (2)/(3)
   * clear/consume the flag that gates them.
   */
  async evaluateStates(): Promise<{ evaluated: number; downgradesApplied: number; cancellationsFinalized: number }> {
    const now = this.clock.now();
    const todayIdx = manilaDayIndex(now);

    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ["AWAITING_CASH", "GRACE", "PAST_DUE"] } },
    });
    let evaluated = 0;
    for (const inv of invoices) {
      const daysSinceDue = todayIdx - manilaDayIndex(inv.dueDate);
      const next = nextState(inv.status as InvoiceState, { type: "DAY_ELAPSED", daysSinceDue });
      if (next === inv.status) continue;
      await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: next } });
      if (inv.subscriptionId) {
        await this.prisma.subscription.update({ where: { id: inv.subscriptionId }, data: { status: subscriptionStatusFor(next) } });
      }
      evaluated += 1;
    }

    const downgradeCandidates = await this.prisma.subscription.findMany({
      where: { pendingPlanId: { not: null }, status: { not: "CANCELLED" } },
    });
    let downgradesApplied = 0;
    for (const sub of downgradeCandidates) {
      if (manilaDayIndex(sub.currentPeriodEnd) > todayIdx) continue;
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { planId: sub.pendingPlanId as string, pendingPlanId: null } });
      downgradesApplied += 1;
    }

    const cancelCandidates = await this.prisma.subscription.findMany({
      where: { cancelRequestedAt: { not: null }, status: { not: "CANCELLED" } },
    });
    let cancellationsFinalized = 0;
    for (const sub of cancelCandidates) {
      if (manilaDayIndex(sub.currentPeriodEnd) > todayIdx) continue;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      cancellationsFinalized += 1;
    }

    return { evaluated, downgradesApplied, cancellationsFinalized };
  }

  /**
   * `entitlements.resetCycle` (daily 00:30). For every non-cancelled subscription crossing a
   * cycle boundary today (`currentPeriodEnd` is today, Manila — read BEFORE `billing.issueInvoices`
   * advances it later at 01:00), seeds fresh usage rows for the upcoming period via
   * `EntitlementService.resetCycle`, which is itself idempotent (upsert with a no-op `update`).
   */
  async resetCycle(): Promise<{ reset: number }> {
    const todayIdx = manilaDayIndex(this.clock.now());
    const subs = await this.prisma.subscription.findMany({ where: { status: { not: "CANCELLED" } } });

    let reset = 0;
    for (const sub of subs) {
      if (manilaDayIndex(sub.currentPeriodEnd) !== todayIdx) continue;
      await this.entitlements.resetCycle(sub.id, sub.currentPeriodEnd);
      reset += 1;
    }
    return { reset };
  }
}
