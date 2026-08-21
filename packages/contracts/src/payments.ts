import { z } from "zod";

/** Body for POST /payments/intents — a member-initiated intent to pay an invoice by e-payment (API §9.1). */
export const paymentIntentCreateSchema = z.object({
  invoiceId: z.string().uuid(),
});
export type PaymentIntentCreate = z.infer<typeof paymentIntentCreateSchema>;

export const paymentIntentSchema = z.object({
  checkoutUrl: z.string().url(),
});
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
