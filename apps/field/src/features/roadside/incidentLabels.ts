import type { IncidentType, RoadsideStatus } from "@autocare/contracts";

/** FR-033 in the words staff and members both use, not the enum's. */
export const INCIDENT_LABEL: Record<IncidentType, string> = {
  FLAT_TYRE: "Flat tyre",
  DEAD_BATTERY: "Dead battery",
  OUT_OF_FUEL: "Out of fuel",
  OVERHEATING: "Overheating",
  WILL_NOT_START: "Won't start",
  ACCIDENT: "Accident",
  OTHER: "Other",
};

/** FR-038's timeline, phrased for the responder rather than the member. */
export const STATUS_LABEL: Record<RoadsideStatus, string> = {
  REQUESTED: "Requested",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  EN_ROUTE: "On the way",
  ON_SITE: "On site",
  RESOLVED: "Resolved",
};

/** Semantic tones only — band colours carry score meaning (design principle 1). */
export const STATUS_TONE: Record<RoadsideStatus, "danger" | "info" | "success"> = {
  REQUESTED: "danger",
  ACKNOWLEDGED: "info",
  DISPATCHED: "info",
  EN_ROUTE: "info",
  ON_SITE: "info",
  RESOLVED: "success",
};

/** What to show when reverse geocoding came back empty (plan D-2). */
export const placeText = (r: { address: string | null; lat: number; lng: number }): string =>
  r.address ?? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
