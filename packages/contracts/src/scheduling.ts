import { z } from "zod";

const yyyymmdd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:mm");
const iso = z.string().datetime({ offset: true });

export const slotQuerySchema = z
  .object({ from: yyyymmdd, to: yyyymmdd, serviceTypeId: z.string().uuid() })
  .refine((v) => {
    const days = (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000;
    return days >= 0 && days <= 30;
  }, "window must be 0..30 days");
export type SlotQuery = z.infer<typeof slotQuerySchema>;

export const holdCreateSchema = z.object({ bayId: z.string(), start: iso, serviceTypeId: z.string() });
export type HoldCreate = z.infer<typeof holdCreateSchema>;

export const appointmentCreateSchema = z.object({
  holdId: z.string(),
  vehicleId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  requiresPickup: z.boolean().default(false),
});
export type AppointmentCreate = z.infer<typeof appointmentCreateSchema>;

export const rescheduleSchema = z.object({ holdId: z.string() });
export type Reschedule = z.infer<typeof rescheduleSchema>;

export const serviceTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  standardDurationMin: z.number().int().positive(),
  requiredSkills: z.array(z.string()).default([]),
  priceCentavos: z.number().int().nonnegative(),
  entitlementType: z.enum(["INSPECTION", "PICKUP", "ROADSIDE", "OIL_CHANGE", "TIRE_ROTATION"]).nullable().optional(),
  intervalDays: z.number().int().positive().nullable().optional(),
  intervalKm: z.number().int().positive().nullable().optional(),
});
export type ServiceTypeInput = z.infer<typeof serviceTypeSchema>;

export const baySchema = z.object({
  name: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
export type BayInput = z.infer<typeof baySchema>;

export const shiftSchema = z.object({
  userId: z.string().uuid(),
  date: yyyymmdd,
  startTime: hhmm,
  endTime: hhmm,
  skills: z.array(z.string()).default([]),
});
export type ShiftInput = z.infer<typeof shiftSchema>;

/** Partial edit of an existing roster entry. `userId` is deliberately absent:
 *  reassigning a shift to a different person is a delete plus a create, not an
 *  edit, so the audit trail keeps the two people distinct. */
export const shiftUpdateSchema = z.object({
  date: yyyymmdd.optional(),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  skills: z.array(z.string()).optional(),
});
export type ShiftUpdate = z.infer<typeof shiftUpdateSchema>;

/** Range for listing the roster; same shape the board and slots queries use. */
export const shiftQuerySchema = z.object({ from: yyyymmdd, to: yyyymmdd });
export type ShiftQuery = z.infer<typeof shiftQuerySchema>;

export const blockSchema = z.object({
  bayId: z.string().uuid().nullable().optional(),
  date: yyyymmdd,
  startTime: hhmm,
  endTime: hhmm,
  reason: z.string().min(1),
});
export type BlockInput = z.infer<typeof blockSchema>;

export const operatingHoursSchema = z.object({
  weekday: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).nullable().optional(),
  dateOverride: yyyymmdd.nullable().optional(),
  openTime: hhmm.nullable().optional(),
  closeTime: hhmm.nullable().optional(),
  walkInBufferPct: z.number().int().min(0).max(100).default(0),
});
export type OperatingHoursInput = z.infer<typeof operatingHoursSchema>;
