import { Injectable } from "@nestjs/common";
import { computeVHS, deriveStatus } from "@autocare/scoring";
import type { PointStatus as EnginePointStatus, ResultInput } from "@autocare/scoring";
import { toChecklistConfig } from "../checklists/config-mapper";
import { InspectionScoringHook } from "../sync/handlers/inspection.handler";
import { SyncTx } from "../sync/sync.types";
import { ScoreEvents } from "./score-events";

const ADVERSE: EnginePointStatus[] = ["MONITOR", "ATTENTION", "CRITICAL"];

/** Runs the pure engine on submission and persists HealthScore + CategoryScore[]
 *  + Recommendation[] in the submitting transaction, then emits score.ready.
 *  Config loads by the inspection's stored checklistVersionId — never "current
 *  active" — so historical recomputes reproduce stored scores (NFR-055). */
@Injectable()
export class ScoringIntegrationService implements InspectionScoringHook {
  constructor(private events: ScoreEvents) {}

  async onSubmitted(tx: SyncTx, inspectionId: string): Promise<void> {
    const inspection = await tx.inspection.findUniqueOrThrow({
      where: { id: inspectionId },
      include: { results: true },
    });
    const version = await tx.checklistVersion.findUniqueOrThrow({
      where: { id: inspection.checklistVersionId },
      include: { categories: { include: { points: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
    });
    const config = toChecklistConfig(version);

    const results: ResultInput[] = inspection.results.map((r) => ({
      pointCode: r.pointCode,
      status: (r.status as EnginePointStatus | null) ?? undefined,
      measuredValue: r.measuredValue ?? undefined,
    }));
    // daysSinceInspection is 0 at compute time; staleness later is display state (BR-05).
    const out = computeVHS({ results, daysSinceInspection: 0 }, config);

    const score = await tx.healthScore.create({
      data: {
        inspectionId: inspection.id,
        vehicleId: inspection.vehicleId,
        score: out.score,
        rawScore: out.rawScore,
        band: out.band,
        confidence: out.confidence,
        overrideApplied: out.overrideApplied,
        checklistVersionId: inspection.checklistVersionId,
        weightVersion: config.weightVersion,
        topDetractors: out.topDetractors as unknown as object,
      },
    });
    let order = 0;
    for (const c of out.categoryScores) {
      await tx.categoryScore.create({
        data: {
          healthScoreId: score.id,
          categoryCode: c.categoryCode,
          label: c.label,
          weight: c.weight,
          score: c.score,
          applicablePoints: c.applicablePoints,
          sortOrder: order++,
        },
      });
    }

    // One recommendation per detracting result; estimatedCostCentavos stays
    // null until Phase 5 quoting.
    const pointsByCode = new Map(version.categories.flatMap((c) => c.points.map((p) => [p.code, p] as const)));
    for (const r of inspection.results) {
      const point = pointsByCode.get(r.pointCode);
      if (!point) continue;
      const status = resolveStatus(point.inputType, r.status, r.measuredValue, point);
      if (!status || !ADVERSE.includes(status)) continue;
      await tx.recommendation.create({
        data: {
          healthScoreId: score.id,
          vehicleId: inspection.vehicleId,
          pointCode: r.pointCode,
          label: point.label,
          severity: status,
          recommendation: point.recommendation,
        },
      });
    }

    this.events.emitScoreReady({ vehicleId: inspection.vehicleId, score: out.score, band: out.band });
  }
}

function resolveStatus(
  inputType: string,
  status: string | null,
  measuredValue: number | null,
  point: { thresholdDirection: string | null; thresholdGood: number | null; thresholdMonitor: number | null; thresholdAttention: number | null },
): EnginePointStatus | undefined {
  if (inputType === "MEASURED" && measuredValue !== null && point.thresholdDirection) {
    return deriveStatus(measuredValue, {
      direction: point.thresholdDirection as "HIGHER_BETTER" | "LOWER_BETTER",
      good: point.thresholdGood!,
      monitor: point.thresholdMonitor!,
      attention: point.thresholdAttention!,
    });
  }
  return (status as EnginePointStatus | null) ?? undefined;
}
