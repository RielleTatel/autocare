import { z } from "zod";

/** PH LTO plate patterns: cars LLL-DDD(D), motorcycles DDD-LLL (Global Constraints). */
export const PLATE_PATTERNS = [/^[A-Z]{3}\s?\d{3,4}$/, /^\d{3}\s?[A-Z]{3}$/];
export const normalizePlate = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

export const plateSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => PLATE_PATTERNS.some((p) => p.test(s)), { message: "Not a valid PH plate (e.g. ABA 1234 or 123 ABC)" })
  .transform(normalizePlate);

export const fuelTypes = ["GASOLINE", "DIESEL", "LPG", "EV", "HYBRID"] as const;
export const transmissions = ["MT", "AT", "CVT"] as const;

export const vehicleCreateSchema = z.object({
  plateNo: plateSchema,
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  variant: z.string().max(60).optional(),
  engineCc: z.number().int().positive().max(10000).optional(),
  fuelType: z.enum(fuelTypes),
  transmission: z.enum(transmissions),
  odometerKm: z.number().int().min(0),
  color: z.string().max(30).optional(),
  vin: z.string().min(11).max(17).optional(),
  /** Date of the member's last service, if known — improves reminder accuracy (FR-047). */
  lastServiceAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((s) => new Date(`${s}T00:00:00Z`).getTime() <= Date.now(), { message: "Last service cannot be in the future" })
    .optional(),
});
export type VehicleCreate = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema
  .omit({ plateNo: true, odometerKm: true }) // plate is identity; odometer has its own endpoint
  .partial()
  .extend({
    photoUrls: z.array(z.string().url()).max(10).optional(),
    orCrUrls: z.array(z.string().url()).max(4).optional(),
  });
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;

export const vehicleSchema = z.object({
  id: z.string().uuid(),
  plateNo: z.string(),
  make: z.string(), model: z.string(), year: z.number().int(),
  variant: z.string().nullable(), engineCc: z.number().int().nullable(),
  fuelType: z.enum(fuelTypes), transmission: z.enum(transmissions),
  color: z.string().nullable(), vin: z.string().nullable(),
  photoUrls: z.array(z.string()), orCrUrls: z.array(z.string()),
  currentOdometerKm: z.number().int(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
  lastServiceAt: z.string().nullable(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const odometerCreateSchema = z.object({
  km: z.number().int().min(0),
  justification: z.string().min(5).max(300).optional(),
});
export type OdometerCreate = z.infer<typeof odometerCreateSchema>;
