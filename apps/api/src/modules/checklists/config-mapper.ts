import type { ChecklistCategory, ChecklistPoint, ChecklistVersion } from "@prisma/client";
import type { ChecklistConfig, ConfigCategory, ConfigPoint, StatusTemplates } from "@autocare/scoring";

export type LoadedChecklist = ChecklistVersion & {
  categories: Array<ChecklistCategory & { points: ChecklistPoint[] }>;
};

/** DB rows → the pure engine's ChecklistConfig. Must be lossless (NFR-055):
 *  a fixture scored against this mapping equals the same fixture scored
 *  against the authored seedConfig — pinned by checklist-seed.e2e-spec. */
export function toChecklistConfig(v: LoadedChecklist): ChecklistConfig {
  const categories: ConfigCategory[] = [...v.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cat) => ({
      code: cat.code,
      label: cat.label,
      labelFil: cat.labelFil ?? undefined,
      weight: cat.weight,
      points: [...cat.points].sort((a, b) => a.sortOrder - b.sortOrder).map(toConfigPoint),
    }));
  return { checklistVersion: v.versionLabel, weightVersion: v.weightVersion, categories };
}

function toConfigPoint(p: ChecklistPoint): ConfigPoint {
  return {
    code: p.code,
    label: p.label,
    labelFil: p.labelFil ?? undefined,
    weightInCategory: p.weightInCategory,
    isSafetyCritical: p.isSafetyCritical,
    inputType: p.inputType,
    unit: p.unit ?? undefined,
    thresholds: p.thresholdDirection
      ? { direction: p.thresholdDirection, good: p.thresholdGood!, monitor: p.thresholdMonitor!, attention: p.thresholdAttention! }
      : undefined,
    recommendation: p.recommendation,
    templates: (p.templates as StatusTemplates | null) ?? undefined,
    requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
    notApplicableWhen: p.notApplicableWhen ?? undefined,
  };
}
