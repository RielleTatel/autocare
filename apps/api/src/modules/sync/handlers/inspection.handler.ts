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

    const version = await tx.checklistVersion.findUnique({ where: { id: p.checklistVersionId } });
    if (!version) throw new DomainError("CHECKLIST_INVALID", "unknown checklist version", 422);
    const points = await tx.checklistPoint.findMany({ where: { category: { checklistVersionId: p.checklistVersionId } } });
    const byCode = new Map(points.map((pt) => [pt.code, pt]));

    const inspection = await tx.inspection.create({
      data: {
        clientUuid: item.clientUuid,
        vehicleId: p.vehicleId,
        appointmentId: p.appointmentId ?? null,
        mechanicId: user.id,
        checklistVersionId: p.checklistVersionId,
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
        const point = byCode.get(r.pointCode);
        if (!point) return null; // unknown codes ignored, mirroring the engine
        return {
          inspectionId: inspection.id,
          pointId: point.id,
          pointCode: r.pointCode,
          status: r.status ?? null,
          measuredValue: r.measuredValue ?? null,
          notes: r.notes ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (rows.length) await tx.inspectionResult.createMany({ data: rows });
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
    const totalPoints = await tx.checklistPoint.count({ where: { category: { checklistVersionId: inspection.checklistVersionId } } });
    const answered = new Set(inspection.results.map((r) => r.pointCode)).size;
    if (answered < totalPoints) {
      throw new DomainError("INSPECTION_INCOMPLETE", `only ${answered}/${totalPoints} checklist points answered`, 422);
    }

    await tx.inspection.update({
      where: { id: inspection.id },
      data: { submittedAt: p.submittedAt ? new Date(p.submittedAt) : new Date() },
    });
    if (this.scoring) await this.scoring.onSubmitted(tx, inspection.id);
  }
}
