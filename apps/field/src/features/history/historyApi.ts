import type { Band, PointStatus } from "@autocare/scoring";
import { api, API_BASE_URL } from "../../shared/api";
import { getDb } from "../../shared/db/schema";

export type VehicleHistoryPoint = {
  /** Stable inspection history identity. */
  id: string;
  inspectionId: string;
  score?: number | null;
  band?: Band | null;
  isStale: boolean;
  computedAt: string;
  odometerKm: number | null;
  scope?: "FULL" | "FOCUSED" | "LEGACY_UNKNOWN";
  templateName?: string | null;
  serviceName?: string | null;
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
  scope?: "FULL" | "FOCUSED" | "LEGACY_UNKNOWN";
  templateName?: string | null;
  serviceName?: string | null;
  observations?: Array<{ id: string; notes: string; photoUrls: string[] }>;
};

const historyKey = (vehicleId: string) => `inspections:${API_BASE_URL}:${vehicleId}`;

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
  const cacheDb = getDb();
  try {
    const fresh = await api.get<Array<{
      id: string; vehicleId: string; appointmentId: string | null; submittedAt: string | null;
      odometerKm: number | null; scope: "FULL" | "FOCUSED" | "LEGACY_UNKNOWN";
      templateName?: string | null; serviceName?: string | null; score?: number | null; band?: Band | null;
    }>>(`/vehicles/${encodeURIComponent(vehicleId)}/inspections`);
    const ordered: VehicleHistoryPoint[] = fresh.filter((row) => row.submittedAt && row.vehicleId === vehicleId)
      .map((row) => ({ ...row, inspectionId: row.id, computedAt: row.submittedAt!, isStale: Date.now() - Date.parse(row.submittedAt!) > 90 * 86_400_000 }))
      .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt));
    const downloadedAt = Date.now();
    await (await cacheDb).runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", historyKey(vehicleId), JSON.stringify({ history: ordered, downloadedAt }));
    return { history: ordered, stale: false, downloadedAt };
  } catch (error) {
    const cached = await (await cacheDb).getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", historyKey(vehicleId));
    if (!cached) throw error;
    const saved = JSON.parse(cached.value);
    return Array.isArray(saved) ? { history: saved, stale: true } : { ...saved, stale: true };
  }
}

/** Per-point detail for one past inspection. Online-only: it is opened on
 *  demand and the payload is too large to be worth caching per inspection. */
export function getInspectionDetail(vehicleId: string, inspectionId: string): Promise<InspectionDetail> {
  return api.get<InspectionDetail>(`/vehicles/${vehicleId}/inspections/${inspectionId}`);
}
