import { vehicleCreateSchema, VehicleCreate } from "@autocare/contracts";

export interface VehicleFormState {
  plateNo: string; make: string; model: string; year: string; variant: string;
  engineCc: string; fuelType: string; transmission: string; odometerKm: string; color: string; vin: string;
  lastServiceAt: string;
}
export const emptyVehicleForm: VehicleFormState = { plateNo: "", make: "", model: "", year: "", variant: "",
  engineCc: "", fuelType: "GASOLINE", transmission: "AT", odometerKm: "", color: "", vin: "", lastServiceAt: "" };

export type FormResult = { ok: true; data: VehicleCreate } | { ok: false; errors: Partial<Record<keyof VehicleFormState, string>> };

export function validateVehicleForm(f: VehicleFormState): FormResult {
  const candidate = {
    plateNo: f.plateNo, make: f.make.trim(), model: f.model.trim(),
    year: Number(f.year) || 0,
    variant: f.variant.trim() || undefined,
    engineCc: f.engineCc ? Number(f.engineCc) : undefined,
    fuelType: f.fuelType, transmission: f.transmission,
    odometerKm: Number(f.odometerKm) || 0,
    color: f.color.trim() || undefined,
    vin: f.vin.trim() || undefined,
    lastServiceAt: f.lastServiceAt.trim() || undefined,
  };
  const parsed = vehicleCreateSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { ok: false, errors };
}
