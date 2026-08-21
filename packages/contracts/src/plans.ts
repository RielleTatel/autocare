import { z } from "zod";

export const entitlementTypes = ["INSPECTION", "PICKUP", "ROADSIDE", "OIL_CHANGE", "TIRE_ROTATION"] as const;
export const billingIntervals = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

export const planEntitlementSchema = z.object({
  entitlementType: z.enum(entitlementTypes),
  quantityPerCycle: z.number().int().nonnegative(),
  overagePriceCentavos: z.number().int().nonnegative(),
});
export type PlanEntitlementInput = z.infer<typeof planEntitlementSchema>;

export const planCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  priceCentavos: z.number().int().nonnegative(),
  billingInterval: z.enum(billingIntervals),
  lockInMonths: z.number().int().nonnegative(),
  entitlements: z.array(planEntitlementSchema),
});
export type PlanCreate = z.infer<typeof planCreateSchema>;

export const planUpdateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  priceCentavos: z.number().int().nonnegative().optional(),
  billingInterval: z.enum(billingIntervals).optional(),
  lockInMonths: z.number().int().nonnegative().optional(),
  entitlements: z.array(planEntitlementSchema).optional(),
});
export type PlanUpdate = z.infer<typeof planUpdateSchema>;

export const planEntitlementResponseSchema = planEntitlementSchema.extend({
  id: z.string().uuid(),
});

export const planSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  billingInterval: z.enum(billingIntervals),
  lockInMonths: z.number().int(),
  isActive: z.boolean(),
  version: z.number().int(),
  entitlements: z.array(planEntitlementResponseSchema),
});
export type Plan = z.infer<typeof planSchema>;
