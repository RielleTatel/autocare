import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SubscriptionCreate, SubscriptionUpgrade, SubscriptionDowngrade, SubscriptionCancel } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { subscriptionStatusFor, nextState } from "../payments/invoice-lifecycle";
import { addMonthsManila, proratedUpgradeCentavos, etfCentavos, remainingLockInMonths, INTERVAL_MONTHS } from "./billing-math";
import { nextInvoiceNumber, withInvoiceNumberRetry } from "./invoice-numbering";

const SUBSCRIPTION_SELECT = {
  id: true, vehicleId: true, planId: true, userId: true, status: true, startedAt: true,
  lockInEndsAt: true, currentPeriodStart: true, currentPeriodEnd: true, paymentMethod: true,
  cancelRequestedAt: true, pendingPlanId: true,
} as const;

const PLAN_SUMMARY_SELECT = { id: true, code: true, name: true, priceCentavos: true, billingInterval: true, lockInMonths: true } as const;
const SUBSCRIPTION_WITH_PLAN_SELECT = { ...SUBSCRIPTION_SELECT, plan: { select: PLAN_SUMMARY_SELECT } } as const;

type SubscriptionRow = Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_SELECT }>;
type SubscriptionWithPlanRow = Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_WITH_PLAN_SELECT }>;
type PlanSummaryRow = Prisma.PlanGetPayload<{ select: typeof PLAN_SUMMARY_SELECT }>;

const toIso = (d: Date | null) => (d ? d.toISOString() : null);

const toSubscriptionResponse = (row: SubscriptionRow) => ({
  ...row,
  startedAt: row.startedAt.toISOString(),
  lockInEndsAt: row.lockInEndsAt.toISOString(),
  currentPeriodStart: row.currentPeriodStart.toISOString(),
  currentPeriodEnd: row.currentPeriodEnd.toISOString(),
  cancelRequestedAt: toIso(row.cancelRequestedAt),
});

const toPlanSummary = (row: PlanSummaryRow) => ({ ...row, priceCentavos: Number(row.priceCentavos) });

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService, private vehicles: VehiclesService) {}

  private async loadPlanOrThrow(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new DomainError("FORBIDDEN_ROLE", "Plan not found", 404);
    return plan;
  }

  /**
   * Ownership-checked load (with plan summary) — reused by every mutating/read subscription
   * route, including `get()`, so the 404 + ownership-check logic lives in exactly one place.
   */
  private async findForUser(user: AbilityUser, id: string, vehicleAction: "read" | "update" = "read"): Promise<SubscriptionWithPlanRow> {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, select: SUBSCRIPTION_WITH_PLAN_SELECT });
    if (!sub) throw new DomainError("FORBIDDEN_ROLE", "Subscription not found", 404);
    await this.vehicles.findForUser(user, sub.vehicleId, vehicleAction);
    return sub;
  }

  async create(user: AbilityUser, dto: SubscriptionCreate) {
    await this.vehicles.findForUser(user, dto.vehicleId, "update"); // owner-only
    const plan = await this.loadPlanOrThrow(dto.planId);

    // Friendly, fast-path check — not race-safe on its own (two concurrent requests can both
    // pass this and both attempt to insert an ACTIVE row for the same vehicle). The DB-level
    // backstop is the partial unique index `subscriptions_one_active_per_vehicle` (migration
    // 20260821112628) on (vehicle_id) WHERE status = 'ACTIVE', enforced below.
    const active = await this.prisma.subscription.findFirst({
      where: { vehicleId: dto.vehicleId, status: "ACTIVE" },
    });
    if (active) throw new DomainError("SUBSCRIPTION_ALREADY_ACTIVE", "This vehicle already has an active subscription", 409);

    const now = new Date();
    const lockInEndsAt = addMonthsManila(now, plan.lockInMonths);
    const currentPeriodEnd = addMonthsManila(now, INTERVAL_MONTHS[plan.billingInterval] ?? 1);
    // Reuses Task 2's invoice-lifecycle status mapping rather than re-deriving it — a freshly
    // issued invoice always maps to ACTIVE, but going through subscriptionStatusFor keeps this
    // in lockstep with the state machine instead of drifting if that mapping ever changes.
    const initialStatus = subscriptionStatusFor("INVOICE_ISSUED");

    const row = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        let created;
        try {
          created = await tx.subscription.create({
            data: {
              vehicleId: dto.vehicleId,
              planId: plan.id,
              userId: user.id,
              status: initialStatus,
              startedAt: now,
              lockInEndsAt,
              currentPeriodStart: now,
              currentPeriodEnd,
              paymentMethod: dto.paymentMethod,
            },
            select: SUBSCRIPTION_SELECT,
          });
        } catch (e) {
          // Race-guard backstop: the partial unique index rejects a second concurrent
          // ACTIVE row for this vehicle with P2002 — surface the same friendly error the
          // pre-check above returns, instead of a raw 500.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            throw new DomainError("SUBSCRIPTION_ALREADY_ACTIVE", "This vehicle already has an active subscription", 409);
          }
          throw e;
        }
        const number = await nextInvoiceNumber(tx);
        // Advance past INVOICE_ISSUED immediately — an invoice left at INVOICE_ISSUED can
        // never be settled (neither the cash nor auto-charge paths query for it). Mirrors
        // the renewal path in billing.service.ts.
        const invoiceStatus = nextState("INVOICE_ISSUED", { type: "ISSUED", method: dto.paymentMethod });
        await tx.invoice.create({
          data: {
            subscriptionId: created.id,
            number,
            totalCentavos: plan.priceCentavos,
            status: invoiceStatus,
            dueDate: now,
            items: {
              create: [{ description: `${plan.name} (${plan.billingInterval})`, qty: 1, unitPriceCentavos: plan.priceCentavos }],
            },
          },
        });
        return created;
      }),
    );

    return toSubscriptionResponse(row);
  }

  async list(user: AbilityUser) {
    if (user.role === "FLEET_MANAGER" && !user.orgId) return [];
    const vehicleOwner = user.role === "FLEET_MANAGER" ? { orgOwnerId: user.orgId } : { ownerUserId: user.id };
    const rows = await this.prisma.subscription.findMany({
      where: { vehicle: vehicleOwner },
      select: SUBSCRIPTION_WITH_PLAN_SELECT,
      orderBy: { startedAt: "desc" },
    });
    return rows.map((r) => ({ ...toSubscriptionResponse(r), plan: toPlanSummary(r.plan) }));
  }

  async get(user: AbilityUser, id: string) {
    const sub = await this.findForUser(user, id, "read");
    return { ...toSubscriptionResponse(sub), plan: toPlanSummary(sub.plan) };
  }

  async entitlements(user: AbilityUser, id: string) {
    const sub = await this.findForUser(user, id, "read");
    const plan = await this.prisma.plan.findUnique({
      where: { id: sub.planId },
      select: { entitlements: { select: { entitlementType: true, quantityPerCycle: true } } },
    });
    if (!plan) throw new DomainError("FORBIDDEN_ROLE", "Plan not found", 404);

    const usages = await this.prisma.entitlementUsage.findMany({
      where: { subscriptionId: sub.id, periodStart: sub.currentPeriodStart },
      select: { entitlementType: true, usedQty: true },
    });
    const usedByType = new Map(usages.map((u) => [u.entitlementType, u.usedQty]));

    return plan.entitlements.map((e) => {
      const usedQty = usedByType.get(e.entitlementType) ?? 0;
      return { entitlementType: e.entitlementType, quantityPerCycle: e.quantityPerCycle, usedQty, remaining: Math.max(e.quantityPerCycle - usedQty, 0) };
    });
  }

  async upgrade(user: AbilityUser, id: string, dto: SubscriptionUpgrade) {
    const sub = await this.findForUser(user, id, "update");
    const [currentPlan, newPlan] = await Promise.all([
      this.loadPlanOrThrow(sub.planId),
      this.loadPlanOrThrow(dto.planId),
    ]);
    if (newPlan.priceCentavos <= currentPlan.priceCentavos)
      throw new DomainError("SUBSCRIPTION_NOT_UPGRADE", "Target plan must be higher-priced than the current plan", 422);
    if (sub.status !== "ACTIVE")
      throw new DomainError("SUBSCRIPTION_NOT_ACTIVE", "Only an ACTIVE subscription can be upgraded", 409);

    const now = new Date();
    const periodDays = Math.max(Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / DAY_MS), 1);
    const remainingDays = Math.max(Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS), 0);
    const deltaCentavos = proratedUpgradeCentavos(Number(currentPlan.priceCentavos), Number(newPlan.priceCentavos), remainingDays, periodDays);

    const row = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({ where: { id: sub.id }, data: { planId: newPlan.id }, select: SUBSCRIPTION_SELECT });
        const number = await nextInvoiceNumber(tx);
        const invoiceStatus = nextState("INVOICE_ISSUED", { type: "ISSUED", method: sub.paymentMethod });
        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            number,
            totalCentavos: deltaCentavos,
            status: invoiceStatus,
            dueDate: now,
            items: { create: [{ description: `Upgrade to ${newPlan.name} (pro-rated)`, qty: 1, unitPriceCentavos: deltaCentavos }] },
          },
        });
        return updated;
      }),
    );

    return { ...toSubscriptionResponse(row), proratedChargeCentavos: deltaCentavos };
  }

  async downgrade(user: AbilityUser, id: string, dto: SubscriptionDowngrade) {
    const sub = await this.findForUser(user, id, "update");
    const [currentPlan, newPlan] = await Promise.all([
      this.loadPlanOrThrow(sub.planId),
      this.loadPlanOrThrow(dto.planId),
    ]);
    if (newPlan.priceCentavos >= currentPlan.priceCentavos)
      throw new DomainError("SUBSCRIPTION_NOT_DOWNGRADE", "Target plan must be lower-priced than the current plan", 422);

    const row = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { pendingPlanId: newPlan.id },
      select: SUBSCRIPTION_SELECT,
    });
    // Applies at the next billing cycle — a Task 8 scheduled job swaps `planId` to
    // `pendingPlanId` (and clears it) once `currentPeriodEnd` is reached.
    return { ...toSubscriptionResponse(row), effectiveAt: row.currentPeriodEnd.toISOString() };
  }

  async cancellationQuote(user: AbilityUser, id: string) {
    const sub = await this.findForUser(user, id, "read");
    const plan = await this.loadPlanOrThrow(sub.planId);
    const now = new Date();
    const remainingMonths = remainingLockInMonths(sub.lockInEndsAt, now);
    return {
      etfCentavos: etfCentavos(Number(plan.priceCentavos), remainingMonths),
      lockInEndsAt: sub.lockInEndsAt.toISOString(),
      remainingMonths,
    };
  }

  async cancel(user: AbilityUser, id: string, dto: SubscriptionCancel) {
    const sub = await this.findForUser(user, id, "update");
    if (sub.status === "CANCELLED")
      throw new DomainError("SUBSCRIPTION_ALREADY_CANCELLED", "This subscription is already cancelled", 409);
    const plan = await this.loadPlanOrThrow(sub.planId);
    const now = new Date();
    const insideLockIn = now.getTime() < sub.lockInEndsAt.getTime();

    if (!insideLockIn) {
      const row = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { cancelRequestedAt: now },
        select: SUBSCRIPTION_SELECT,
      });
      // Outside lock-in: cancellation is deferred to period end (Task 8 job flips status
      // to CANCELLED at currentPeriodEnd) — status stays ACTIVE until then.
      return toSubscriptionResponse(row);
    }

    if (!dto.acceptEtf)
      throw new DomainError("SUBSCRIPTION_LOCKED_IN", "Cancelling inside the lock-in period requires accepting the early termination fee", 409);

    const remainingMonths = remainingLockInMonths(sub.lockInEndsAt, now);
    const etf = etfCentavos(Number(plan.priceCentavos), remainingMonths);

    const row = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({
          where: { id: sub.id },
          data: { status: "CANCELLED", cancelRequestedAt: now },
          select: SUBSCRIPTION_SELECT,
        });
        const number = await nextInvoiceNumber(tx);
        const invoiceStatus = nextState("INVOICE_ISSUED", { type: "ISSUED", method: sub.paymentMethod });
        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            number,
            totalCentavos: etf,
            status: invoiceStatus,
            dueDate: now,
            items: { create: [{ description: "Early Termination Fee (BR-08)", qty: 1, unitPriceCentavos: etf }] },
          },
        });
        return updated;
      }),
    );

    return { ...toSubscriptionResponse(row), etfCentavos: etf };
  }
}
