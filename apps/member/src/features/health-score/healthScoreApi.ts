import { ApiClient } from "@autocare/api-client";
import type { Band, Confidence, Override, PointStatus } from "@autocare/scoring";

export type CategoryScore = {
  categoryCode: string;
  label: string;
  weight: number;
  score: number;
  applicablePoints: number;
};
export type Detractor = {
  pointCode: string;
  label: string;
  status: PointStatus;
  scoreImpact: number;
  recommendation: string;
};
export type Recommendation = {
  pointCode: string;
  label: string;
  severity: PointStatus;
  recommendation: string;
  estimatedCostCentavos: number | null;
};
export type HealthScore = {
  id: string;
  vehicleId: string;
  score: number;
  rawScore: number;
  band: Band;
  confidence: Confidence;
  overrideApplied: Override;
  isStale: boolean;
  computedAt: string;
  odometerKm: number | null;
  inspectionId: string;
  checklistVersion: string;
  checklistVersionId: string;
  weightVersion: string;
  topDetractors: Detractor[];
  categoryScores: CategoryScore[];
  recommendations: Recommendation[];
};
export type HealthScoreHistoryPoint = {
  id: string;
  score: number;
  band: Band;
  isStale: boolean;
  computedAt: string;
  odometerKm: number | null;
};
export type InspectionResultDetail = {
  pointCode: string;
  label: string;
  labelFil: string | null;
  categoryId: string;
  status: PointStatus | null;
  measuredValue: number | null;
  unit: string | null;
  thresholds: { direction: string; good: number; monitor: number; attention: number } | null;
  templates: Record<string, string> | null;
  recommendation: string;
  isSafetyCritical: boolean;
  notes: string | null;
  photoUrls: string[];
};
export type InspectionDetail = {
  id: string;
  submittedAt: string | null;
  odometerKm: number | null;
  results: InspectionResultDetail[];
};

export type CertificateVisibility = "PRIVATE" | "LINK" | "REVOKED";
export type CreatedCertificate = { id: string; publicToken: string; verificationCode: string; url: string };

/** Typed health-score calls on the shared `api` client, mirroring bookingApi. */
export function makeHealthScoreApi(api: ApiClient) {
  return {
    getScore: (vehicleId: string) => api.get<HealthScore>(`/vehicles/${vehicleId}/health-score`),
    getHistory: (vehicleId: string) => api.get<HealthScoreHistoryPoint[]>(`/vehicles/${vehicleId}/health-score/history`),
    getInspection: (vehicleId: string, inspectionId: string) =>
      api.get<InspectionDetail>(`/vehicles/${vehicleId}/inspections/${inspectionId}`),
    createCertificate: (vehicleId: string, healthScoreId?: string) =>
      api.post<CreatedCertificate>(`/vehicles/${vehicleId}/certificates`, healthScoreId ? { healthScoreId } : {}),
    setCertificateVisibility: (certId: string, visibility: CertificateVisibility) =>
      api.patch<{ id: string; visibility: CertificateVisibility }>(`/certificates/${certId}/visibility`, { visibility }),
  };
}
export type HealthScoreApi = ReturnType<typeof makeHealthScoreApi>;
