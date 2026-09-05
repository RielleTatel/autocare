import { Injectable } from "@nestjs/common";
import type { AttentionItem } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { aggregateAttention, AttentionInputs } from "./attention.aggregate";
import { AnnouncementsService } from "../announcements/announcements.service";

const ENTITLEMENT_EXPIRY_WINDOW_DAYS = 14;
/** A service-due thread left open this long is treated as overdue rather than merely due. */
const SERVICE_DUE_WINDOW_DAYS = 14;

/** Read-only aggregation of the four attention feeds (FR-109→FR-113). Computes
 *  on request — no cache table to invalidate. Each feed is a separate query
 *  mapped into the pure aggregator. */
@Injectable()
export class AttentionService {
  constructor(private prisma: PrismaService, private announcements: AnnouncementsService) {}

  async build(memberId: string, now = new Date()): Promise<AttentionItem[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ownerUserId: memberId, status: "ACTIVE" },
      select: { id: true, plateNo: true },
    });
    if (vehicles.length === 0) return [];
    const vehicleIds = vehicles.map((v) => v.id);
    const plates = new Map(vehicles.map((v) => [v.id, v.plateNo]));

    const [componentFindings, recommendations, entitlementsExpiring, servicesDue] = await Promise.all([
      this.componentFindings(vehicleIds),
      this.openRecommendations(vehicleIds),
      this.entitlementsExpiring(memberId, now),
      this.servicesDue(vehicleIds, now),
    ]);

    const inputs: AttentionInputs = {
      componentFindings,
      recommendations,
      entitlementsExpiring,
      servicesDue,
      plates,
      multiVehicle: vehicles.length > 1,
    };
    return aggregateAttention(inputs);
  }

  /** ATTENTION/CRITICAL results from each vehicle's latest health score. */
  private async componentFindings(vehicleIds: string[]): Promise<AttentionInputs["componentFindings"]> {
    const out: AttentionInputs["componentFindings"] = [];
    for (const vehicleId of vehicleIds) {
      const score = await this.prisma.healthScore.findFirst({
        where: { vehicleId },
        orderBy: { computedAt: "desc" },
        include: { inspection: { include: { results: { include: { point: { include: { category: true } } } } } } },
      });
      if (!score) continue;
      for (const r of score.inspection.results) {
        if (r.status === "ATTENTION" || r.status === "CRITICAL") {
          out.push({
            vehicleId,
            categoryCode: r.point.category.code,
            pointCode: r.pointCode,
            label: r.point.label,
            severity: r.status,
            inspectionId: score.inspectionId,
            createdAt: score.computedAt,
          });
        }
      }
    }
    return out;
  }

  private async openRecommendations(vehicleIds: string[]): Promise<AttentionInputs["recommendations"]> {
    const recs = await this.prisma.recommendation.findMany({
      where: { vehicleId: { in: vehicleIds }, status: { in: ["OPEN", "QUOTED", "DEFERRED"] }, severity: { in: ["MONITOR", "ATTENTION", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
    });
    return recs.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      label: r.label,
      recommendation: r.recommendation,
      severity: r.severity as "MONITOR" | "ATTENTION" | "CRITICAL",
      createdAt: r.createdAt,
    }));
  }

  private async entitlementsExpiring(memberId: string, now: Date): Promise<AttentionInputs["entitlementsExpiring"]> {
    const subs = await this.prisma.subscription.findMany({
      where: { userId: memberId, status: { in: ["ACTIVE", "GRACE"] } },
      include: { plan: { include: { entitlements: true } }, entitlementUsages: true },
    });
    const out: AttentionInputs["entitlementsExpiring"] = [];
    for (const sub of subs) {
      const daysToExpiry = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
      if (daysToExpiry < 0 || daysToExpiry > ENTITLEMENT_EXPIRY_WINDOW_DAYS) continue;
      for (const ent of sub.plan.entitlements) {
        const used = sub.entitlementUsages
          .filter((u) => u.entitlementType === ent.entitlementType && u.periodStart.getTime() === sub.currentPeriodStart.getTime())
          .reduce((s, u) => s + u.usedQty, 0);
        const remaining = ent.quantityPerCycle - used;
        if (remaining <= 0) continue;
        out.push({
          vehicleId: sub.vehicleId,
          subscriptionId: sub.id,
          entitlementType: ent.entitlementType,
          remaining,
          daysToExpiry,
          periodEnd: sub.currentPeriodEnd,
        });
      }
    }
    return out;
  }

  /**
   * Service-due items come from ACTIVE announcement threads (design spec §7) — the announcements
   * table is the single source. `publishedAt` is a real due signal, unlike the old ServiceReminder
   * `createdAt` stand-in, so `overdue` can be computed honestly instead of always being true.
   */
  private async servicesDue(vehicleIds: string[], now: Date): Promise<AttentionInputs["servicesDue"]> {
    const threads = await this.announcements.activeServiceDue(vehicleIds);
    return threads.map((t) => ({
      vehicleId: t.vehicleId,
      serviceTypeId: t.serviceTypeId,
      serviceTypeName: t.serviceTypeName,
      dueDate: t.publishedAt,
      overdue: now.getTime() - t.publishedAt.getTime() >= SERVICE_DUE_WINDOW_DAYS * 86_400_000,
    }));
  }
}
