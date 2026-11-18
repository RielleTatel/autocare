import { z } from "zod";

export const workOrderStatuses = ["DRAFT", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "QC", "READY", "CLOSED", "CANCELLED"] as const;
export const repairWorkflowStatuses = ["IN_PROGRESS", "AWAITING_ADMIN_REVIEW", "RETURNED_FOR_CORRECTION", "VERIFIED", "STOPPED"] as const;
export const itemApprovalStatuses = ["PENDING", "APPROVED", "DECLINED", "DEFERRED"] as const;
export const wasteTypes = ["USED_OIL", "BATTERY", "FILTER", "TIRE", "COOLANT"] as const;

export const createWorkOrderSchema = z.object({
  vehicleId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  inspectionId: z.string().uuid().optional(),
  customerComplaint: z.string().max(2000).optional(),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const addWorkOrderItemSchema = z.object({
  type: z.enum(["PART", "LABOR"]),
  partSku: z.string().max(64).optional(),
  description: z.string().min(1).max(500),
  qty: z.number().int().min(1).default(1),
  unitPriceCentavos: z.number().int().min(0),
  discountCentavos: z.number().int().min(0).default(0),
  recommendationId: z.string().uuid().optional(),
});
export type AddWorkOrderItemInput = z.infer<typeof addWorkOrderItemSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(workOrderStatuses),
  technicianSummary: z.string().max(4000).optional(),
  /** Advisor override to allow stock to go negative on closure. */
  stockOverrideReason: z.string().max(500).optional(),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const itemDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "DECLINED", "DEFERRED"]),
});
export type ItemDecisionInput = z.infer<typeof itemDecisionSchema>;

export const batchDecisionsSchema = z.object({
  decisions: z.array(z.object({ itemId: z.string().uuid(), decision: z.enum(["APPROVED", "DECLINED", "DEFERRED"]) })).min(1),
});
export type BatchDecisionsInput = z.infer<typeof batchDecisionsSchema>;

export const addWasteSchema = z.object({
  clientUuid: z.string().uuid().optional(),
  wasteType: z.enum(wasteTypes),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(16),
  haulerName: z.string().max(200).optional(),
  manifestNo: z.string().max(120).optional(),
});
export type AddWasteInput = z.infer<typeof addWasteSchema>;

export const setMarkDoneSchema = z.object({ done: z.boolean() });
export type SetMarkDoneInput = z.infer<typeof setMarkDoneSchema>;

export const partCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(64),
  costCentavos: z.number().int().min(0),
  priceCentavos: z.number().int().min(0),
  stockQty: z.number().int().default(0),
  reorderLevel: z.number().int().min(0).default(0),
});
export type PartCreateInput = z.infer<typeof partCreateSchema>;

export const partUpdateSchema = partCreateSchema.partial().omit({ sku: true });
export type PartUpdateInput = z.infer<typeof partUpdateSchema>;

export const simpleRepairStartSchema = z.object({
  clientUuid: z.string().uuid(),
  notes: z.string().trim().min(1).max(4000),
  estimatedTotalCentavos: z.number().int().min(0).max(100_000_000),
});
export type SimpleRepairStartInput = z.infer<typeof simpleRepairStartSchema>;

export const simpleRepairUpdateSchema = z.object({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  notes: z.string().trim().min(1).max(4000),
  estimatedTotalCentavos: z.number().int().min(0).max(100_000_000),
});
export type SimpleRepairUpdateInput = z.infer<typeof simpleRepairUpdateSchema>;

export const simpleRepairScheduleReturnSchema = z.object({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  holdId: z.string().min(1).max(512),
});
export type SimpleRepairScheduleReturnInput = z.infer<typeof simpleRepairScheduleReturnSchema>;

export const simpleRepairCompleteSchema = z.object({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  rechecked: z.literal(true),
  completionNotes: z.string().trim().max(2000).optional(),
});
export type SimpleRepairCompleteInput = z.infer<typeof simpleRepairCompleteSchema>;

export const simpleRepairStopSchema = z.object({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  completedWorkNotes: z.string().trim().min(1).max(4000),
  reason: z.string().trim().min(1).max(1000),
});
export type SimpleRepairStopInput = z.infer<typeof simpleRepairStopSchema>;

export const finalBillingReturnSchema = z.object({
  operationId: z.string().uuid().optional(),
  expectedVersion: z.number().int().min(0),
  reason: z.string().trim().min(1).max(1000),
});
export type FinalBillingReturnInput = z.infer<typeof finalBillingReturnSchema>;

export const finalBillingIssueSchema = z.object({
  operationId: z.string().uuid().optional(),
  expectedVersion: z.number().int().min(0),
  finalRepairCentavos: z.number().int().min(0).max(100_000_000).optional(),
  serviceChargeCentavos: z.number().int().min(0).max(100_000_000).optional(),
  serviceChargeReason: z.string().trim().min(1).max(1000).optional(),
});
export type FinalBillingIssueInput = z.infer<typeof finalBillingIssueSchema>;
