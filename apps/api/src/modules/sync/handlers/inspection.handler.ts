import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  inspectionCreatePayloadSchema, inspectionSubmitPayloadSchema, SyncItemInput,
} from "@autocare/contracts";
import { DomainError } from "../../../common/errors/domain-error";
import { AbilityUser } from "../../../common/policies/ability.factory";
import { SyncEntityHandler, SyncTx } from "../sync.types";

/** Task 8 wires the real scoring integration behind this token; until then
 *  submission persists without a score (the score computes on first wire-up). */
export const INSPECTION_SCORING = Symbol("INSPECTION_SCORING");
export interface InspectionScoringHook {
  onSubmitted(tx: SyncTx, inspectionId: string): Promise<void>;
}

@Injectable()
export class InspectionSyncHandler implements SyncEntityHandler {
  readonly entityType = "inspection" as const;

  constructor(@Optional() @Inject(INSPECTION_SCORING) private scoring: InspectionScoringHook | null) {}

  async apply(tx: SyncTx, user: AbilityUser, item: SyncItemInput): Promise<void> {
    // BR-06: only certified technicians may record inspections.
    const dbUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.isCertifiedTechnician) {
      throw new DomainError("NOT_CERTIFIED_TECHNICIAN", "only certified technicians can record inspections", 403);
    }

    if (item.op === "create") return this.create(tx, user, item);
    return this.submit(tx, item);
  }

  private async create(tx: SyncTx, user: AbilityUser, item: SyncItemInput): Promise<void> {
    const parsed = inspectionCreatePayloadSchema.safeParse(item.payload);
    if (!parsed.success) {
      throw new DomainError("INSPECTION_INCOMPLETE", `invalid inspection payload: ${parsed.error.issues[0]?.message}`, 422);
    }
    const p = parsed.data;

    const booking = p.appointmentId
      ? await tx.appointment.findUnique({
          where: { id: p.appointmentId },
          include: { serviceType: true, inspectionTemplateVersion: { include: { template: true } } },
        })
      : null;
    if (p.appointmentId) {
      if (!booking) throw new DomainError("INSPECTION_BOOKING_NOT_FOUND", "the inspection's booking no longer exists", 422);
      if (booking.vehicleId !== p.vehicleId) {
        throw new DomainError("INSPECTION_BOOKING_MISMATCH", "the inspection vehicle does not match its booking", 422);
      }
      const inspectionRequired = booking.inspectionRequiredSnapshot ?? booking.serviceType.inspectionRequired;
      if (!inspectionRequired) throw new DomainError("INSPECTION_INCOMPLETE", "this booked service does not require an inspection", 422);
      if (booking.inspectionRequiredSnapshot === true && !booking.inspectionTemplateVersionId) {
        throw new DomainError("INSPECTION_TEMPLATE_UNCONFIGURED", "this booking has no pinned inspection template; ask an administrator to review its inspection setup", 409);
      }
      if (booking.inspectionTemplateVersionId && booking.inspectionTemplateVersionId !== p.checklistVersionId) {
        throw new DomainError("INSPECTION_CHECKLIST_MISMATCH", "the inspection checklist does not match the version pinned to this booking", 409, {
          expectedVersionId: booking.inspectionTemplateVersionId,
        });
      }
    }

    const version = await tx.checklistVersion.findUnique({ where: { id: p.checklistVersionId }, include: { template: true } });
    if (!version) {
      // Names both ids: this rejection is almost always a device that cached a
      // checklist from an earlier seed of this database, and the message is the
      // only diagnostic the technician's sync queue ever surfaces.
      const active = await tx.checklistVersion.findFirst({ where: { isActive: true }, select: { id: true } });
      throw new DomainError(
        "CHECKLIST_INVALID",
        `unknown checklist version ${p.checklistVersionId}; active version is ${active?.id ?? "none"}`,
        422,
      );
    }
    if (version.status !== "PUBLISHED" && version.id !== booking?.inspectionTemplateVersionId) {
      throw new DomainError("CHECKLIST_INVALID", "only a published inspection checklist can be used for a new report", 422);
    }
    // A booking created before template pinning has no recoverable service scope.
    // It may keep using the legacy global checklist, but a subsequently-added
    // focused template must never be attached retroactively to that visit.
    if (booking && !booking.inspectionTemplateVersionId && version.templateId !== null) {
      throw new DomainError("INSPECTION_CHECKLIST_MISMATCH", "this older booking can only use a legacy global checklist; its inspection scope cannot be changed after booking", 409);
    }
    const points = await tx.checklistPoint.findMany({ where: { category: { checklistVersionId: p.checklistVersionId } } });
    const byCode = new Map(points.map((pt) => [pt.code, pt]));
    const seenCodes = new Set<string>();
    for (const result of p.results) {
      if (seenCodes.has(result.pointCode)) throw new DomainError("INSPECTION_INCOMPLETE", `duplicate result for ${result.pointCode}`, 422);
      seenCodes.add(result.pointCode);
      const point = byCode.get(result.pointCode);
      if (!point) throw new DomainError("CHECKLIST_INVALID", `unknown check ${result.pointCode} for this checklist version`, 422);
      if (point.inputType === "STATUS" && result.status === undefined) {
        throw new DomainError("INSPECTION_INCOMPLETE", `status is required for ${result.pointCode}`, 422);
      }
      if (point.inputType === "MEASURED" && result.measuredValue === undefined) {
        throw new DomainError("INSPECTION_INCOMPLETE", `measurement is required for ${result.pointCode}`, 422);
      }
    }
    const scope = booking?.inspectionTemplateVersion
      ? booking.inspectionTemplateVersion.template?.scope ?? "LEGACY_UNKNOWN"
      : version.template?.scope ?? (version.isActive ? "FULL" : "LEGACY_UNKNOWN");

    const inspection = await tx.inspection.create({
      data: {
        clientUuid: item.clientUuid,
        vehicleId: p.vehicleId,
        appointmentId: p.appointmentId ?? null,
        mechanicId: user.id,
        checklistVersionId: p.checklistVersionId,
        scope,
        templateNameSnapshot: booking?.inspectionTemplateVersion?.template?.name ?? version.template?.name ?? null,
        serviceNameSnapshot: booking?.serviceNameSnapshot ?? booking?.serviceType.name ?? null,
        odometerKm: p.odometerKm ?? null,
        startedAt: p.startedAt ? new Date(p.startedAt) : null,
        notes: p.notes ?? null,
      },
    });
    // Batch-insert all results in a single round trip. Doing 50 sequential
    // creates inside one interactive transaction blows past Prisma's 5s
    // transaction timeout on a high-latency remote DB (the tx closes mid-loop).
    const rows = p.results
      .map((r) => {
        const point = byCode.get(r.pointCode)!; // every code was validated above.
        return {
          inspectionId: inspection.id,
          pointId: point.id,
          pointCode: r.pointCode,
          status: r.status ?? null,
          measuredValue: r.measuredValue ?? null,
          notes: r.notes ?? null,
        };
      });
    if (rows.length) await tx.inspectionResult.createMany({ data: rows });
    if (p.additionalObservations?.length) {
      await tx.inspectionObservation.createMany({
        data: p.additionalObservations.map((observation) => ({
          clientUuid: observation.clientUuid,
          inspectionId: inspection.id,
          notes: observation.notes,
        })),
      });
    }
  }

  private async submit(tx: SyncTx, item: SyncItemInput): Promise<void> {
    const parsed = inspectionSubmitPayloadSchema.safeParse(item.payload);
    if (!parsed.success) {
      throw new DomainError("INSPECTION_INCOMPLETE", "invalid submit payload", 422);
    }
    const p = parsed.data;
    const inspection = await tx.inspection.findUnique({ where: { clientUuid: p.inspectionClientUuid }, include: { results: true } });
    if (!inspection) throw new DomainError("INSPECTION_INCOMPLETE", "inspection to submit was never created", 422);
    if (inspection.submittedAt) return; // idempotent-friendly: already submitted

    // Completeness (FR-057): every checklist point needs a result (N/A counts).
    const points = await tx.checklistPoint.findMany({
      where: { category: { checklistVersionId: inspection.checklistVersionId } },
      select: { code: true },
    });
    const expected = new Set(points.map((point) => point.code));
    const answered = new Set(inspection.results.map((r) => r.pointCode)).size;
    const extra = inspection.results.find((result) => !expected.has(result.pointCode));
    if (extra) throw new DomainError("CHECKLIST_INVALID", `result ${extra.pointCode} is outside the pinned checklist`, 422);
    if (answered !== expected.size) {
      throw new DomainError("INSPECTION_INCOMPLETE", `only ${answered}/${expected.size} checklist points answered`, 422);
    }

    await tx.inspection.update({
      where: { id: inspection.id },
      data: { submittedAt: p.submittedAt ? new Date(p.submittedAt) : new Date() },
    });
    if (this.scoring) await this.scoring.onSubmitted(tx, inspection.id);

    // A submitted inspection is the completion signal for the booking it was
    // done for — there is no separate "mark done" step, which keeps the field
    // app offline-first (this rides the same sync batch).
    //
    // updateMany, not update: a missing appointment must not throw and roll back
    // an otherwise-valid inspection. Accepted work resolves an automatic
    // NO_SHOW even when the device uploads after the nightly sweep. An explicit
    // cancellation remains authoritative. Match the vehicle as well so legacy
    // bad links cannot complete another vehicle's appointment.
    if (inspection.appointmentId) {
      await tx.appointment.updateMany({
        where: {
          id: inspection.appointmentId,
          vehicleId: inspection.vehicleId,
          status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS", "NO_SHOW"] },
        },
        data: { status: "COMPLETED" },
      });
    }
  }
}
