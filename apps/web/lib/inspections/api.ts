// Typed fetcher for the advisor's health-score rail. Goes through the BFF proxy,
// which attaches the httpOnly session cookie.
import type { BandName } from "../../components/BandChip";

export type VehicleHealthScore = {
  score: number;
  band: BandName;
  categoryScores: Array<{ categoryCode: string; label: string; score: number }>;
};

export async function getHealthScore(vehicleId: string): Promise<VehicleHealthScore> {
  const res = await fetch(`/api/proxy/vehicles/${vehicleId}/health-score`, {
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as VehicleHealthScore;
}
