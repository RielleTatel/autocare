import { z } from "zod";
import { errorCodes } from "./errors";

const metaSchema = z.object({ page: z.number(), perPage: z.number(), total: z.number() }).nullable();
const errorBody = z.object({ code: z.enum(errorCodes), message: z.string(), details: z.unknown().optional() });

export function envelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data, meta: metaSchema, error: z.null() }),
    z.object({ success: z.literal(false), data: z.null(), meta: z.null(), error: errorBody }),
  ]);
}
export type Envelope<T> = { success: true; data: T; meta: { page: number; perPage: number; total: number } | null; error: null }
  | { success: false; data: null; meta: null; error: { code: (typeof errorCodes)[number]; message: string; details?: unknown } };
