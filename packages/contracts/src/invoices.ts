import { z } from "zod";

export const invoiceStatuses = [
  "INVOICE_ISSUED", "AWAITING_AUTO_CHARGE", "AWAITING_CASH", "RETRYING",
  "GRACE", "PAID", "PAST_DUE", "SUSPENDED",
] as const;

export const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  qty: z.number().int(),
  unitPriceCentavos: z.number().int(),
  taxCentavos: z.number().int(),
  source: z.enum(["LEGACY", "SERVICE", "REPAIR"]).optional(),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

/** GET /invoices and GET /invoices/:id — itemized invoice, money as integer centavos (number). */
export const invoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  subscriptionId: z.string().uuid().nullable(),
  appointmentId: z.string().uuid().nullable().optional(),
  workOrderId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  plateNo: z.string().nullable().optional(),
  serviceName: z.string().nullable().optional(),
  documentKind: z.enum(["BILL", "NO_CHARGE"]).optional(),
  totalCentavos: z.number().int(),
  status: z.enum(invoiceStatuses),
  dueDate: z.string(),
  issuedAt: z.string(),
  checkoutEligible: z.boolean().optional(),
  items: z.array(invoiceItemSchema),
  payment: z.object({
    method: z.string(),
    status: z.string(),
    tenderedCentavos: z.number().int().nullable().optional(),
    changeCentavos: z.number().int().nullable().optional(),
  }).nullable().optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

/** GET /invoices/:id/pdf — a short-lived signed download URL for the rendered receipt. */
export const invoicePdfResponseSchema = z.object({
  url: z.string().url(),
});
export type InvoicePdfResponse = z.infer<typeof invoicePdfResponseSchema>;
