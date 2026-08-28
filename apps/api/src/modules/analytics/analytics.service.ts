import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CLOCK, type Clock } from "../../common/clock/clock";
import { UtilisationService } from "../scheduling/utilisation.service";
import { CONTRACTED_STATUSES, churnRate, mrrCentavos, type BillingIntervalName } from "./metrics";

const CHURN_WINDOW_DAYS = 30;
const UTILISATION_WINDOW_DAYS = 14;

export type AnalyticsSummary = {
  /** Decimal string — centavos are bigint server-side and JSON has no bigint. */
  mrrCentavos: string;
  activeMembers: number;
  churn30d: number;
  bayUtilisation: number;
};

/** Admin reporting for the dashboard. Every figure is defined in the 2026-08-28 spec. */
@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private utilisation: UtilisationService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  async summary(u: AbilityUser): Promise<AnalyticsSummary> {
    this.assertAdmin(u);

    const now = this.clock.now();
    const windowStart = new Date(now.getTime() - CHURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const contracted = [...CONTRACTED_STATUSES];

    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: contracted } },
      select: { userId: true, plan: { select: { priceCentavos: true, billingInterval: true } } },
    });

    const mrr = mrrCentavos(
      subs.map((s) => ({
        priceCentavos: s.plan.priceCentavos,
        interval: s.plan.billingInterval as BillingIntervalName,
      })),
    );
    const activeMembers = new Set(subs.map((s) => s.userId)).size;

    // Order matters: the churn denominator is the population contracted when the
    // window opened — everyone still contracted, plus everyone who left during it.
    const cancelledInWindow = await this.prisma.subscription.count({
      where: { status: "CANCELLED", cancelledAt: { gte: windowStart, lte: now } },
    });
    const contractedNow = await this.prisma.subscription.count({
      where: { status: { in: contracted } },
    });

    const days = await this.utilisation.forWindow(
      now.toISOString().slice(0, 10),
      UTILISATION_WINDOW_DAYS,
    );
    const bayUtilisation = days.length === 0
      ? 0
      : days.reduce((sum, d) => sum + d.ratio, 0) / days.length;

    return {
      mrrCentavos: mrr.toString(),
      activeMembers,
      churn30d: churnRate(cancelledInWindow, contractedNow + cancelledInWindow),
      bayUtilisation,
    };
  }
}
