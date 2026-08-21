import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SubscriptionCreate, SubscriptionUpgrade, SubscriptionDowngrade, SubscriptionCancel } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { addMonthsManila, proratedUpgradeCentavos, etfCentavos, remainingLockInMonths } from "./billing-math";

const SUBSCRIPTION_SELECT = {
  id: true, vehicleId: true, planId: true, userId: true, status: true, startedAt: true,
  lockInEndsAt: true, currentPeriodStart: true, currentPeriodEnd: true, paymentMethod: true,
  cancelRequestedAt: true, pendingPlanId: true,
} as const;

const PLAN_SUMMARY_SELECT = { id: true, code: true, name: true, priceCentavos: true, billingInterval: true, lockInMonths: true } as const;

type SubscriptionRow = Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_SELECT }>;
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

/** Months-per-cycle for each billing interval — drives currentPeriodEnd / next-cycle math. */
const INTERVAL_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Invoice numbering (Task 4 decision): `INV-<year>-<6-digit counter>`, counter = count of
 * invoices already issued this year + 1. Because two concurrent requests can both read the
 * same count before either commits, a collision surfaces as a Postgres unique-constraint
 * violation (P2002) on `Invoice.number` — `withInvoiceNumberRetry` catches that and retries
 * the whole creation with a freshly-read count. This is correct but not lock-free; if
 * invoice-creation throughput ever becomes a bottleneck, swap for a Postgres `SEQUENCE`.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await tx.invoice.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

async function withInvoiceNumberRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const isCollision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isCollision || i === attempts - 1) throw e;
    }
  }
  /* istanbul ignore next — unreachable: loop always returns or throws */
  throw new Error("unreachable");
}

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService, private vehicles: VehiclesService) {}

  private async loadPlanOrThrow(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new DomainError("FORBIDDEN_ROLE", "Plan not found", 404);
    return plan;
  }

  /** Ownership-checked load — reused by every mutating/read subscription route. */
  private async findForUser(user: AbilityUser, id: string, vehicleAction: "read" | "update" = "read") {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, select: SUBSCRIPTION_SELECT });
    if (!sub) throw new DomainError("FORBIDDEN_ROLE", "Subscription not found", 404);
    await this.vehicles.findForUser(user, sub.vehicleId, vehicleAction);
    return sub;
  }

  async create(user: AbilityUser, dto: SubscriptionCreate) {
    await this.vehicles.findForUser(user, dto.vehicleId, "update"); // owner-only
    const plan = await this.loadPlanOrThrow(dto.planId);

    const active = await this.prisma.subscription.findFirst({
      where: { vehicleId: dto.vehicleId, status: "ACTIVE" },
    });
    if (active) throw new DomainError("SUBSCRIPTION_ALREADY_ACTIVE", "This vehicle already has an active subscription", 409);

    const now = new Date();
    const lockInEndsAt = addMonthsManila(now, plan.lockInMonths);
    const currentPeriodEnd = addMonthsManila(now, INTERVAL_MONTHS[plan.billingInterval] ?? 1);

    const row = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.subscription.create({
          data: {
            vehicleId: dto.vehicleId,
            planId: plan.id,
            userId: user.id,
            status: "ACTIVE",
            startedAt: now,
            lockInEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd,
            paymentMethod: dto.paymentMethod,
          },
          select: SUBSCRIPTION_SELECT,
        });
        const number = await nextInvoiceNumber(tx);
        await tx.invoice.create({
          data: {
            subscriptionId: created.id,
            number,
            totalCentavos: plan.priceCentavos,
            status: "INVOICE_ISSUED",
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
      select: { ...SUBSCRIPTION_SELECT, plan: { select: PLAN_SUMMARY_SELECT } },
      orderBy: { startedAt: "desc" },
    });
    return rows.map((r) => ({ ...toSubscriptionResponse(r), plan: toPlanSummary(r.plan) }));
  }

  async get(user: AbilityUser, id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      select: { ...SUBSCRIPTION_SELECT, plan: { select: PLAN_SUMMARY_SELECT } },
    });
    if (!sub) throw new DomainError("FORBIDDEN_ROLE", "Subscription not found", 404);
    await this.vehicles.findForUser(user, sub.vehicleId, "read");
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

    const now = new Date();
    const periodDays = Math.max(Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / DAY_MS), 1);
    const remainingDays = Math.max(Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS), 0);
    const deltaCentavos = proratedUpgradeCentavos(Number(currentPlan.priceCentavos), Number(newPlan.priceCentavos), remainingDays, periodDays);

    const row = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({ where: { id: sub.id }, data: { planId: newPlan.id }, select: SUBSCRIPTION_SELECT });
        const number = await nextInvoiceNumber(tx);
        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            number,
            totalCentavos: deltaCentavos,
            status: "INVOICE_ISSUED",
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
        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            number,
            totalCentavos: etf,
            status: "INVOICE_ISSUED",
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
