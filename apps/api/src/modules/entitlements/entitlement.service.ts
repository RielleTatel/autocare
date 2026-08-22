import { Injectable } from "@nestjs/common";
import { EntitlementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "EXHAUSTED"; overagePriceCentavos: number }
  | { ok: false; reason: "SUSPENDED" };

export type UsageRow = {
  entitlementType: EntitlementType;
  quantityPerCycle: number;
  usedQty: number;
  remaining: number;
};

/**
 * Per-cycle entitlement quota enforcement (FR-021, FR-022, BR-03).
 *
 * Consumed by Phases 3/4/6 (inspection booking, pickup, roadside dispatch, etc.) and Task 8
 * (billing/cycle jobs). Kept deliberately dependency-light — only PrismaService — so it can be
 * imported by any feature module without pulling in auth/policy plumbing.
 */
@Injectable()
export class EntitlementService {
  constructor(private prisma: PrismaService) {}

  private async loadSubscriptionOrThrow(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { status: true, planId: true, currentPeriodStart: true },
    });
    if (!sub) throw new DomainError("FORBIDDEN_ROLE", "Subscription not found", 404);
    return sub;
  }

  /**
   * Atomically consumes `qty` of `type` against the subscription's CURRENT period quota.
   *
   * Blocking rule (FR-027, §7.6): only SUSPENDED blocks consumption. A subscription in GRACE
   * (payment retry pending but not yet suspended) keeps its entitlements live — do NOT add
   * GRACE to the block-list here; that regressed FR-027 once already, see the spec's
   * "GRACE subscription — still consumable" test.
   *
   * Plan-coverage rule: if the plan has no `PlanEntitlement` row for `type` at all (the plan
   * simply doesn't include that entitlement), quota is treated as 0 and the call is EXHAUSTED
   * with `overagePriceCentavos: 0` — there is no PlanEntitlement row to read a price from, so
   * the caller (billing) decides how/whether to price out-of-plan usage.
   *
   * Concurrency: the increment is guarded at the DB level via a conditional `updateMany` whose
   * `where` clause requires `usedQty <= quota - qty`. Two concurrent transactions racing on the
   * same usage row can both pass the upsert, but only one `updateMany` can match its predicate
   * once the first writer's row is committed — Postgres serializes the row-level write, so the
   * loser's affected-row count comes back 0 and it is reported EXHAUSTED. This holds without
   * needing SERIALIZABLE isolation or an explicit `SELECT ... FOR UPDATE`.
   */
  async consume(subscriptionId: string, type: EntitlementType, qty: number, sourceRef?: string): Promise<ConsumeResult> {
    const sub = await this.loadSubscriptionOrThrow(subscriptionId);

    if (sub.status === "SUSPENDED") return { ok: false, reason: "SUSPENDED" };

    const planEntitlement = await this.prisma.planEntitlement.findFirst({
      where: { planId: sub.planId, entitlementType: type },
    });
    if (!planEntitlement) return { ok: false, reason: "EXHAUSTED", overagePriceCentavos: 0 };

    const quota = planEntitlement.quantityPerCycle;
    const periodStart = sub.currentPeriodStart;

    const consumed = await this.prisma.$transaction(async (tx) => {
      // Ensure the current-period usage row exists before the conditional increment below can
      // target it. `update: {}` is a deliberate no-op on the happy path where the row already
      // exists — creation only matters the first time this (subscription, period, type) triple
      // is touched.
      await tx.entitlementUsage.upsert({
        where: { subscriptionId_periodStart_entitlementType: { subscriptionId, periodStart, entitlementType: type } },
        create: { subscriptionId, periodStart, entitlementType: type, usedQty: 0, sourceRef },
        update: {},
      });

      const updated = await tx.entitlementUsage.updateMany({
        where: {
          subscriptionId,
          periodStart,
          entitlementType: type,
          usedQty: { lte: quota - qty },
        },
        data: { usedQty: { increment: qty }, ...(sourceRef !== undefined ? { sourceRef } : {}) },
      });

      return updated.count > 0;
    });

    if (!consumed) return { ok: false, reason: "EXHAUSTED", overagePriceCentavos: Number(planEntitlement.overagePriceCentavos) };
    return { ok: true };
  }

  /** Current-period usage per plan entitlement. Backs `GET /subscriptions/:id/entitlements`. */
  async usageFor(subscriptionId: string): Promise<UsageRow[]> {
    const sub = await this.loadSubscriptionOrThrow(subscriptionId);

    const [entitlements, usages] = await Promise.all([
      this.prisma.planEntitlement.findMany({
        where: { planId: sub.planId },
        select: { entitlementType: true, quantityPerCycle: true },
      }),
      this.prisma.entitlementUsage.findMany({
        where: { subscriptionId, periodStart: sub.currentPeriodStart },
        select: { entitlementType: true, usedQty: true },
      }),
    ]);
    const usedByType = new Map(usages.map((u) => [u.entitlementType, u.usedQty]));

    return entitlements.map((e) => {
      const usedQty = usedByType.get(e.entitlementType) ?? 0;
      return { entitlementType: e.entitlementType, quantityPerCycle: e.quantityPerCycle, usedQty, remaining: Math.max(e.quantityPerCycle - usedQty, 0) };
    });
  }

  /**
   * Seeds fresh (usedQty=0) usage rows for every entitlement in the subscription's current
   * plan at `newPeriodStart` — called at a cycle boundary (Task 8). Idempotent: upserting with
   * `update: {}` means re-running for a period that already has rows is a no-op rather than
   * resetting usage that's already accrued in that period.
   */
  async resetCycle(subscriptionId: string, newPeriodStart: Date): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { planId: true } });
    if (!sub) throw new DomainError("FORBIDDEN_ROLE", "Subscription not found", 404);

    const entitlements = await this.prisma.planEntitlement.findMany({
      where: { planId: sub.planId },
      select: { entitlementType: true },
    });

    await this.prisma.$transaction(
      entitlements.map((e) =>
        this.prisma.entitlementUsage.upsert({
          where: { subscriptionId_periodStart_entitlementType: { subscriptionId, periodStart: newPeriodStart, entitlementType: e.entitlementType } },
          create: { subscriptionId, periodStart: newPeriodStart, entitlementType: e.entitlementType, usedQty: 0 },
          update: {},
        }),
      ),
    );
  }
}
