import { z } from "zod";

/** FR-033 — the incident types a member may choose. */
export const incidentTypes = [
  "FLAT_TYRE",
  "DEAD_BATTERY",
  "OUT_OF_FUEL",
  "OVERHEATING",
  "WILL_NOT_START",
  "ACCIDENT",
  "OTHER",
] as const;
export type IncidentType = (typeof incidentTypes)[number];

/** FR-038 — the status timeline shown to the member, in order. */
export const roadsideStatuses = [
  "REQUESTED",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "EN_ROUTE",
  "ON_SITE",
  "RESOLVED",
] as const;
export type RoadsideStatus = (typeof roadsideStatuses)[number];

/**
 * `address` is optional because reverse geocoding is best-effort: a member on a
 * thin signal, or a rate-limited geocoder, still has to be able to raise an
 * emergency. `landmarkNote` is how a member describes where they are when the
 * machine cannot (FR-032).
 */
export const roadsideRequestSchema = z.object({
  vehicleId: z.string().uuid(),
  incidentType: z.enum(incidentTypes),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(300).optional(),
  landmarkNote: z.string().max(300).optional(),
});
export type RoadsideRequestInput = z.infer<typeof roadsideRequestSchema>;

export const roadsideStatusSchema = z.object({
  status: z.enum(roadsideStatuses),
  etaMinutes: z.number().int().min(0).max(600).optional(),
});
export type RoadsideStatusInput = z.infer<typeof roadsideStatusSchema>;

export const roadsideDispatchSchema = z.object({
  responderUserId: z.string().uuid().optional(),
  responderName: z.string().min(2).max(120),
  etaMinutes: z.number().int().min(0).max(600).optional(),
});
export type RoadsideDispatchInput = z.infer<typeof roadsideDispatchSchema>;

export const roadsideResolveSchema = z.object({
  resolutionNotes: z.string().min(3).max(1000),
  costCentavos: z.number().int().min(0),
});
export type RoadsideResolveInput = z.infer<typeof roadsideResolveSchema>;

/** FR-034/FR-035 — why the button is or is not available, in the member's words. */
export type RoadsideEligibility = {
  eligible: boolean;
  /** Present when `eligible` is false: a non-punitive explanation. */
  reason?: string;
  /** Remaining covered call-outs this cycle, when known. */
  remainingCallouts?: number | null;
  /** ISO date the waiting period ends, when that is what is blocking. */
  eligibleFrom?: string | null;
  /** FR-035 — what a non-eligible member can do instead. */
  paidAlternativeCentavos?: number | null;
};

export type RoadsideRequestView = {
  id: string;
  vehicleId: string;
  incidentType: IncidentType;
  lat: number;
  lng: number;
  address: string | null;
  landmarkNote: string | null;
  status: RoadsideStatus;
  responderName: string | null;
  etaMinutes: number | null;
  createdAt: string;
  resolvedAt: string | null;
};
