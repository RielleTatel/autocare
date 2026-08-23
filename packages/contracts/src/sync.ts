import { z } from "zod";
import { pointStatusSchema } from "./checklists";

/** Offline sync batch envelope (Phase 4 Task 6). Phase 5/6 entity types are
 *  reserved here; their handlers register server-side without touching sync core. */
export const syncEntityTypes = ["inspection", "waste_record", "trip_status", "trip_condition", "payment_cash"] as const;
export const syncOps = ["create", "submit"] as const;

export const syncItemSchema = z.object({
  clientUuid: z.string().uuid(),
  entityType: z.enum(syncEntityTypes),
  op: z.enum(syncOps),
  payload: z.record(z.unknown()),
});

export const syncBatchSchema = z.object({
  items: z.array(syncItemSchema).min(1).max(100),
});
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type SyncItemInput = z.infer<typeof syncItemSchema>;

export type SyncItemResultStatus = "APPLIED" | "DUPLICATE" | "REJECTED";
export interface SyncItemResult {
  clientUuid: string;
  status: SyncItemResultStatus;
  error?: { code: string; message: string };
}
export interface SyncBatchResponse { results: SyncItemResult[] }

/** Payloads for the inspection handler. Content is client-authoritative
 *  ("client wins") — the server validates shape + business rules only. */
export const inspectionResultInputSchema = z.object({
  pointCode: z.string().min(1),
  status: pointStatusSchema.optional(),
  measuredValue: z.number().optional(),
  notes: z.string().max(2000).optional(),
});

export const inspectionCreatePayloadSchema = z.object({
  vehicleId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  checklistVersionId: z.string().uuid(),
  odometerKm: z.number().int().min(0).optional(),
  startedAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
  results: z.array(inspectionResultInputSchema).min(1),
});
export type InspectionCreatePayload = z.infer<typeof inspectionCreatePayloadSchema>;

export const inspectionSubmitPayloadSchema = z.object({
  inspectionClientUuid: z.string().uuid(),
  submittedAt: z.string().datetime().optional(),
});
export type InspectionSubmitPayload = z.infer<typeof inspectionSubmitPayloadSchema>;
