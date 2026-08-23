import { z } from "zod";

export const pointStatusSchema = z.enum(["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"]);
export type PointStatusInput = z.infer<typeof pointStatusSchema>;

export const thresholdsSchema = z.object({
  direction: z.enum(["HIGHER_BETTER", "LOWER_BETTER"]),
  good: z.number(),
  monitor: z.number(),
  attention: z.number(),
});

export const checklistPointSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1),
  labelFil: z.string().min(1).optional(),
  weightInCategory: z.number().min(0).max(100),
  isSafetyCritical: z.boolean().default(false),
  inputType: z.enum(["STATUS", "MEASURED"]),
  unit: z.string().max(16).optional(),
  thresholds: thresholdsSchema.optional(),
  recommendation: z.string().min(1),
  templates: z.record(z.string()).optional(),
  requiresPhotoOnAdverse: z.boolean().default(false),
  notApplicableWhen: z.string().optional(),
});

export const checklistCategorySchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1),
  labelFil: z.string().min(1).optional(),
  weight: z.number().min(0).max(100),
  points: z.array(checklistPointSchema).min(1),
});

export const checklistDraftPatchSchema = z.object({
  categories: z.array(checklistCategorySchema).min(1),
});
export type ChecklistDraftPatch = z.infer<typeof checklistDraftPatchSchema>;

export const previewScoreSchema = z.object({
  results: z.array(z.object({
    pointCode: z.string().min(1),
    status: pointStatusSchema.optional(),
    measuredValue: z.number().optional(),
  })),
  daysSinceInspection: z.number().int().min(0).default(0),
});
export type PreviewScoreInput = z.infer<typeof previewScoreSchema>;
