import { Inject, Injectable, Optional } from "@nestjs/common";
import type { DiagramZone } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { storagePathFromReference } from "../../common/storage/storage-reference";
import type { InspectionPhotoAttachInput, InspectionPhotoReadInput } from "@autocare/contracts";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService, @Optional() @Inject(STORAGE_PORT) private storage?: StoragePort) {}

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
      where: { vehicleId, inspection: { scope: "FULL", submittedAt: { not: null } } },
      orderBy: { inspection: { submittedAt: "desc" } },
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
      inspectedAt: score.inspection.submittedAt,
      scope: "FULL" as const,
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
      where: { vehicleId, inspection: { scope: "FULL", submittedAt: { not: null } } },
      orderBy: { inspection: { submittedAt: "asc" } },
      include: { inspection: true },
    });
    return scores.map((s) => ({
      id: s.id,
      // `id` above is the HealthScore's, which the detail route cannot take.
      // Without this a history row has no way to open the inspection behind it.
      inspectionId: s.inspectionId,
      appointmentId: s.inspection.appointmentId,
      vehicleId,
      score: s.score,
      band: s.band,
      isStale: s.isStale,
      computedAt: s.computedAt,
      inspectedAt: s.inspection.submittedAt,
      odometerKm: s.inspection.odometerKm,
    }));
  }

  async listInspections(u: AbilityUser, vehicleId: string) {
    await this.assertCanReadVehicle(u, vehicleId);
    const inspections = await this.prisma.inspection.findMany({
      where: { vehicleId, submittedAt: { not: null } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      include: {
        healthScore: { select: { score: true, band: true } },
        appointment: { include: { invoice: { select: { id: true } } } },
        workOrders: { where: { simpleRepair: true }, include: { invoices: { select: { id: true } } }, orderBy: { openedAt: "desc" } },
      },
    });
    return inspections.map((inspection) => ({
      id: inspection.id,
      vehicleId: inspection.vehicleId,
      appointmentId: inspection.appointmentId,
      submittedAt: inspection.submittedAt,
      inspectedAt: inspection.submittedAt,
      odometerKm: inspection.odometerKm,
      scope: inspection.scope,
      templateName: inspection.templateNameSnapshot,
      serviceName: inspection.serviceNameSnapshot,
      score: inspection.scope === "FULL" ? inspection.healthScore?.score ?? null : null,
      band: inspection.scope === "FULL" ? inspection.healthScore?.band ?? null : null,
      invoiceId: inspection.appointment?.invoice?.id ?? inspection.workOrders.flatMap((workOrder) => workOrder.invoices)[0]?.id ?? null,
    }));
  }

  /** Results grouped for M-14: every component with its status/value/photos. */
  async inspectionDetail(u: AbilityUser, vehicleId: string, inspectionId: string) {
    await this.assertCanReadVehicle(u, vehicleId);
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, vehicleId },
      include: {
        healthScore: true,
        results: { include: { point: { include: { category: true } } } },
        observations: { orderBy: { createdAt: "asc" } },
        appointment: { include: { invoice: { select: { id: true } } } },
        workOrders: { where: { simpleRepair: true }, include: { invoices: { select: { id: true } } }, orderBy: { openedAt: "desc" } },
      },
    });
    if (!inspection) throw new DomainError("INSPECTION_INCOMPLETE", "inspection not found", 404);
    const results = await Promise.all(inspection.results.map(async (r) => ({
      pointCode: r.pointCode,
      label: r.point.label,
      labelFil: r.point.labelFil,
      categoryId: r.point.categoryId,
      categoryCode: r.point.category.code,
      diagramZone: (r.point.diagramZoneId ?? null) as DiagramZone | null,
      inputType: r.point.inputType,
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
      photoUrls: await this.signedPhotoUrls(r.photoUrls),
    })));
    const observations = await Promise.all(inspection.observations.map(async (observation) => ({
      id: observation.id,
      clientUuid: observation.clientUuid,
      notes: observation.notes,
      photoUrls: await this.signedPhotoUrls(observation.photoUrls),
    })));
    return {
      id: inspection.id,
      clientUuid: inspection.clientUuid,
      vehicleId: inspection.vehicleId,
      appointmentId: inspection.appointmentId,
      scope: inspection.scope,
      templateName: inspection.templateNameSnapshot,
      serviceName: inspection.serviceNameSnapshot,
      score: inspection.healthScore?.score ?? null,
      band: inspection.healthScore?.band ?? null,
      scorePending: inspection.scope === "FULL" && !!inspection.submittedAt && !inspection.healthScore,
      submittedAt: inspection.submittedAt,
      odometerKm: inspection.odometerKm,
      results,
      observations,
      invoiceId: inspection.appointment?.invoice?.id ?? inspection.workOrders.flatMap((workOrder) => workOrder.invoices)[0]?.id ?? null,
      repairWorkOrder: inspection.workOrders[0] ? {
        id: inspection.workOrders[0].id,
        number: inspection.workOrders[0].number,
        status: inspection.workOrders[0].repairStatus,
        invoiceId: inspection.workOrders[0].invoices[0]?.id ?? null,
      } : null,
    };
  }

  async attachPhoto(u: AbilityUser, inspectionClientUuid: string, dto: InspectionPhotoAttachInput) {
    if (dto.inspectionClientUuid !== inspectionClientUuid) {
      throw new DomainError("CHECKLIST_INVALID", "photo request inspection does not match the route", 422);
    }
    if (!["MECHANIC", "ADMIN"].includes(u.role)) throw new DomainError("FORBIDDEN_ROLE", "only mechanics and administrators may attach inspection photos", 403);
    const staff = await this.prisma.user.findUnique({ where: { id: u.id }, select: { isCertifiedTechnician: true } });
    if (!staff?.isCertifiedTechnician) throw new DomainError("NOT_CERTIFIED_TECHNICIAN", "only certified technicians can attach inspection photos", 403);
    const inspection = await this.prisma.inspection.findUnique({ where: { clientUuid: inspectionClientUuid } });
    if (!inspection?.submittedAt) throw new DomainError("CHECKLIST_INVALID", "photos can be attached only to an accepted inspection", 409);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    const storagePath = bucket ? storagePathFromReference(dto.storagePath, bucket) : dto.storagePath.replace(/^\/+/, "");
    const prefix = `inspections/${inspection.vehicleId}/${inspection.id}/`;
    if (!storagePath || !storagePath.startsWith(prefix) || storagePath.includes("..")) {
      throw new DomainError("CHECKLIST_INVALID", "photo storage reference does not belong to this inspection", 422);
    }
    const photo = await this.prisma.inspectionPhoto.findUnique({ where: { clientUuid: dto.clientUuid } });
    const targetType = dto.target.type;
    const observation = targetType === "OBSERVATION"
      ? await this.prisma.inspectionObservation.findFirst({ where: { inspectionId: inspection.id, clientUuid: dto.target.observationClientUuid }, select: { id: true } })
      : null;
    if (targetType === "OBSERVATION" && !observation) throw new DomainError("CHECKLIST_INVALID", "inspection observation not found", 404);
    if (!photo || photo.inspectionId !== inspection.id || photo.storagePath !== storagePath || photo.target !== targetType ||
        photo.pointCode !== (targetType === "RESULT" ? dto.target.pointCode : null) || photo.observationId !== (observation?.id ?? null)) {
      throw new DomainError("CHECKLIST_INVALID", "photo upload authorization does not match this finding", 409);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inspection_photos WHERE id = ${photo.id}::uuid FOR UPDATE`;
      const current = await tx.inspectionPhoto.findUniqueOrThrow({ where: { id: photo.id } });
      if (current.attachedAt) return;
      if (current.target === "RESULT" && current.pointCode) {
        const result = await tx.inspectionResult.findUnique({ where: { inspectionId_pointCode: { inspectionId: inspection.id, pointCode: current.pointCode } } });
        if (!result) throw new DomainError("CHECKLIST_INVALID", "inspection result not found", 404);
        if (!result.photoUrls.includes(current.storagePath)) {
          await tx.inspectionResult.update({ where: { id: result.id }, data: { photoUrls: { push: current.storagePath } } });
        }
      } else if (current.observationId) {
        const finding = await tx.inspectionObservation.findUnique({ where: { id: current.observationId } });
        if (!finding) throw new DomainError("CHECKLIST_INVALID", "inspection observation not found", 404);
        if (!finding.photoUrls.includes(current.storagePath)) {
          await tx.inspectionObservation.update({ where: { id: finding.id }, data: { photoUrls: { push: current.storagePath } } });
        }
      }
      await tx.inspectionPhoto.update({ where: { id: current.id }, data: { attachedAt: new Date() } });
    });
    return { attached: true, storagePath };
  }

  async signedPhotoRead(u: AbilityUser, inspectionClientUuid: string, dto: InspectionPhotoReadInput) {
    const inspection = await this.prisma.inspection.findUnique({ where: { clientUuid: inspectionClientUuid }, select: { id: true, vehicleId: true } });
    if (!inspection) throw new DomainError("CHECKLIST_INVALID", "inspection not found", 404);
    await this.assertCanReadVehicle(u, inspection.vehicleId);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    const path = bucket ? storagePathFromReference(dto.storageReference, bucket) : dto.storageReference.replace(/^\/+/, "");
    const stored = path ? await this.prisma.inspectionPhoto.findFirst({ where: { inspectionId: inspection.id, storagePath: path, attachedAt: { not: null } } }) : null;
    if (!stored || !path || !path.startsWith(`inspections/${inspection.vehicleId}/${inspection.id}/`)) {
      throw new DomainError("FORBIDDEN_ROLE", "this photo is not attached to the requested inspection", 404);
    }
    if (!this.storage) throw new DomainError("CHECKLIST_INVALID", "photo storage is unavailable", 503);
    return { signedUrl: await this.storage.createDownloadUrl(stored.storagePath, 60 * 60) };
  }

  private async signedPhotoUrls(references: string[]): Promise<string[]> {
    if (!this.storage) return references;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!bucket) return references;
    return Promise.all(references.map(async (reference) => {
      const path = storagePathFromReference(reference, bucket);
      if (!path) return reference;
      try {
        return await this.storage!.createDownloadUrl(path, 60 * 60);
      } catch {
        // Photos are optional: an expired or temporarily unavailable object must
        // not make a previously accepted inspection unreadable.
        return "";
      }
    })).then((urls) => urls.filter(Boolean));
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
