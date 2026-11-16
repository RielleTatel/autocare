import type { Band, PointStatus } from "@autocare/scoring";
import { api, API_BASE_URL } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";

export type VehicleHistoryPoint = {
  /** The HealthScore id — not usable against the inspection detail route. */
  id: string;
  /** What the detail route takes. Added server-side for exactly this. */
  inspectionId: string;
  score: number;
  band: Band;
  isStale: boolean;
  computedAt: string;
  odometerKm: number | null;
};

export type InspectionResultDetail = {
  pointCode: string;
  label: string;
  categoryCode: string;
  status: PointStatus | null;
  measuredValue: number | null;
  unit: string | null;
  recommendation: string;
  isSafetyCritical: boolean;
  notes: string | null;
  photoUrls: string[];
};

export type InspectionDetail = {
  id: string;
  appointmentId?: string | null;
  vehicleId?: string;
  score?: number | null;
  band?: Band | null;
  submittedAt: string | null;
  odometerKm: number | null;
  results: InspectionResultDetail[];
};

const historyKey = (vehicleId: string) => `vhs:${API_BASE_URL}:${vehicleId}`;

/**
 * Prior inspections for a vehicle, newest first — the reference a technician
 * needs before starting work ("what did we find last time?").
 *
 * Read-only and outside the capture path, so it must never block an inspection:
 * on failure it serves the last download and says so, and an empty list is a
 * normal state (a vehicle with no scored inspection yet), not an error.
 */
export async function getVehicleHistory(
  vehicleId: string,
): Promise<{ history: VehicleHistoryPoint[]; stale: boolean; downloadedAt?: number }> {
  try {
    const fresh = await api.get<VehicleHistoryPoint[]>(`/vehicles/${vehicleId}/health-score/history`);
    // The endpoint returns oldest-first; the useful order here is most recent.
    const ordered = [...fresh].reverse();
    const downloadedAt = Date.now();
    await kvSet(historyKey(vehicleId), JSON.stringify({ history: ordered, downloadedAt }));
    return { history: ordered, stale: false, downloadedAt };
  } catch (error) {
    const cached = await kvGet(historyKey(vehicleId));
    if (!cached) throw error;
    const saved = JSON.parse(cached);
    return Array.isArray(saved) ? { history: saved, stale: true } : { ...saved, stale: true };
  }
}

/** Per-point detail for one past inspection. Online-only: it is opened on
 *  demand and the payload is too large to be worth caching per inspection. */
export function getInspectionDetail(vehicleId: string, inspectionId: string): Promise<InspectionDetail> {
  return api.get<InspectionDetail>(`/vehicles/${vehicleId}/inspections/${inspectionId}`);
}
