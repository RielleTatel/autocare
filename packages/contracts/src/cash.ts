import { z } from "zod";

/** Body for POST /cash-shifts/:id/close (Task 7 — COD cash shifts, FR-084..086). */
export const cashShiftCloseSchema = z.object({
  countedCentavos: z.number().int().nonnegative(),
});
export type CashShiftClose = z.infer<typeof cashShiftCloseSchema>;

export const cashShiftSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  expectedCentavos: z.number().int(),
  countedCentavos: z.number().int().nullable(),
  varianceCentavos: z.number().int().nullable(),
});
export type CashShift = z.infer<typeof cashShiftSchema>;

/** Body for POST /payments/cash (@Idempotent — Idempotency-Key header required). */
export const cashPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountTendered: z.number().int().nonnegative(),
  clientUuid: z.string().uuid(),
});
export type CashPaymentCreate = z.infer<typeof cashPaymentSchema>;

export const cashPaymentResultSchema = z.object({
  paymentId: z.string().uuid(),
  changeCentavos: z.number().int(),
});
export type CashPaymentResult = z.infer<typeof cashPaymentResultSchema>;

/** Row shape for GET /admin/reports/remittance?date=YYYY-MM-DD. */
export const remittanceRowSchema = z.object({
  staffUserId: z.string().uuid(),
  staffName: z.string(),
  systemTotalCentavos: z.number().int(),
  countedCentavos: z.number().int(),
  varianceCentavos: z.number().int(),
  shiftCount: z.number().int(),
});
export type RemittanceRow = z.infer<typeof remittanceRowSchema>;
