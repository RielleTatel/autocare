import { z } from "zod";

export const subscriptionPaymentMethods = ["E_PAYMENT", "COD"] as const;
export const subscriptionStatuses = ["ACTIVE", "GRACE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;

export const subscriptionCreateSchema = z.object({
  vehicleId: z.string().uuid(),
  planId: z.string().uuid(),
  paymentMethod: z.enum(subscriptionPaymentMethods),
});
export type SubscriptionCreate = z.infer<typeof subscriptionCreateSchema>;

export const subscriptionUpgradeSchema = z.object({
  planId: z.string().uuid(),
});
export type SubscriptionUpgrade = z.infer<typeof subscriptionUpgradeSchema>;

export const subscriptionDowngradeSchema = z.object({
  planId: z.string().uuid(),
});
export type SubscriptionDowngrade = z.infer<typeof subscriptionDowngradeSchema>;

export const subscriptionCancelSchema = z.object({
  acceptEtf: z.boolean().optional(),
});
export type SubscriptionCancel = z.infer<typeof subscriptionCancelSchema>;

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  planId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(subscriptionStatuses),
  startedAt: z.string(),
  lockInEndsAt: z.string(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  paymentMethod: z.enum(subscriptionPaymentMethods),
  cancelRequestedAt: z.string().nullable(),
  pendingPlanId: z.string().uuid().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const entitlementSummarySchema = z.object({
  entitlementType: z.string(),
  quantityPerCycle: z.number().int(),
  usedQty: z.number().int(),
  remaining: z.number().int(),
});
export type EntitlementSummary = z.infer<typeof entitlementSummarySchema>;

export const cancellationQuoteSchema = z.object({
  etfCentavos: z.number().int(),
  lockInEndsAt: z.string(),
  remainingMonths: z.number().int(),
});
export type CancellationQuote = z.infer<typeof cancellationQuoteSchema>;
