import { Injectable } from "@nestjs/common";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService) {}

  private async assertCanReadVehicle(u: AbilityUser, vehicleId: string): Promise<void> {
    if (STAFF_ROLES.has(u.role)) return;
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "vehicle not found", 404);
    const ownsDirect = vehicle.ownerUserId === u.id;
    const ownsViaOrg = u.orgId != null && vehicle.orgOwnerId === u.orgId;
    if (!ownsDirect && !ownsViaOrg) throw new DomainError("FORBIDDEN_ROLE", "not your vehicle", 403);
  }

  /** Latest score, API §9.6 shape: score + breakdown + detractors + recommendations. */
  async healthScore(u: AbilityUser, vehicleId: string) {
    await this.assertCanReadVehicle(u, vehicleId);
    const score = await this.prisma.healthScore.findFirst({
      where: { vehicleId },
      orderBy: { computedAt: "desc" },
      include: {
        categoryScores: { orderBy: { sortOrder: "asc" } },
        recommendations: true,
        checklistVersion: true,
        inspection: true,
      },
    });
    if (!score) throw new DomainError("INSPECTION_INCOMPLETE", "no health score yet for this vehicle", 404);
    return {
      id: score.id,
      vehicleId: score.vehicleId,
      score: score.score,
      rawScore: score.rawScore,
      band: score.band,
      confidence: score.confidence,
      overrideApplied: score.overrideApplied,
      isStale: score.isStale,
      computedAt: score.computedAt,
      odometerKm: score.inspection.odometerKm,
      inspectionId: score.inspectionId,
      checklistVersion: score.checklistVersion.versionLabel,
      checklistVersionId: score.checklistVersionId,
      weightVersion: score.weightVersion,
      topDetractors: score.topDetractors,
      categoryScores: score.categoryScores.map((c) => ({
        categoryCode: c.categoryCode, label: c.label, weight: c.weight, score: c.score, applicablePoints: c.applicablePoints,
      })),
      recommendations: score.recommendations.map((r) => ({
        pointCode: r.pointCode, label: r.label, severity: r.severity, recommendation: r.recommendation,
        estimatedCostCentavos: r.estimatedCostCentavos,
      })),
    };
  }

  async history(u: AbilityUser, vehicleId: string) {
    await this.assertCanReadVehicle(u, vehicleId);
    const scores = await this.prisma.healthScore.findMany({
      where: { vehicleId },
      orderBy: { computedAt: "asc" },
      include: { inspection: true },
    });
    return scores.map((s) => ({
      id: s.id,
      score: s.score,
      band: s.band,
      isStale: s.isStale,
      computedAt: s.computedAt,
      odometerKm: s.inspection.odometerKm,
    }));
  }

  /** Results grouped for M-14: every component with its status/value/photos. */
  async inspectionDetail(u: AbilityUser, vehicleId: string, inspectionId: string) {
    await this.assertCanReadVehicle(u, vehicleId);
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, vehicleId },
      include: { results: { include: { point: { include: { category: true } } } } },
    });
    if (!inspection) throw new DomainError("INSPECTION_INCOMPLETE", "inspection not found", 404);
    return {
      id: inspection.id,
      submittedAt: inspection.submittedAt,
      odometerKm: inspection.odometerKm,
      results: inspection.results.map((r) => ({
        pointCode: r.pointCode,
        label: r.point.label,
        labelFil: r.point.labelFil,
        categoryId: r.point.categoryId,
        categoryCode: r.point.category.code,
        status: r.status,
        measuredValue: r.measuredValue,
        unit: r.point.unit,
        thresholds: r.point.thresholdDirection ? {
          direction: r.point.thresholdDirection,
          good: r.point.thresholdGood,
          monitor: r.point.thresholdMonitor,
          attention: r.point.thresholdAttention,
        } : null,
        templates: r.point.templates,
        recommendation: r.point.recommendation,
        isSafetyCritical: r.point.isSafetyCritical,
        notes: r.notes,
        photoUrls: r.photoUrls,
      })),
    };
  }

  /** BR-05 daily job: flip isStale at 90 days. Never touches score values. */
  async markStale(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const res = await this.prisma.healthScore.updateMany({
      where: { computedAt: { lt: cutoff }, isStale: false },
      data: { isStale: true },
    });
    return res.count;
  }
}
