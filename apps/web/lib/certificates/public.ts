// Server-only fetchers for the public certificate pages. No auth: these hit the
// API's @Public() certificate routes directly.

export type PublicCertificate = {
  score: number;
  band: string;
  confidence: string;
  overrideApplied: string;
  isStale: boolean;
  daysSinceInspection: number;
  inspectionDate: string;
  odometerKm: number | null;
  plateNo: string;
  verificationCode: string;
  validUntil: string;
  categoryScores: Array<{ categoryCode: string; label: string; score: number; weight: number }>;
  serviceSummary: { count: number; recent: Array<{ type: string; date: string }> };
};

export type CertificateFetch =
  | { state: "ok"; cert: PublicCertificate }
  | { state: "revoked" }
  | { state: "not_found" };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchPublicCertificate(token: string, revalidateSeconds = 300): Promise<CertificateFetch> {
  const res = await fetch(`${API}/api/v1/public/certificates/${encodeURIComponent(token)}`, {
    next: { revalidate: revalidateSeconds, tags: [`certificate:${token}`] },
  });
  if (res.status === 410) return { state: "revoked" };
  if (!res.ok) return { state: "not_found" };
  const body = await res.json().catch(() => null);
  if (!body?.success) return { state: "not_found" };
  return { state: "ok", cert: body.data as PublicCertificate };
}

const BANDS: Record<string, { fill: string; text: string; labelEn: string; labelFil: string }> = {
  EXCELLENT: { fill: "#177245", text: "#0F5C37", labelEn: "Excellent", labelFil: "Napakaayos" },
  GOOD: { fill: "#5C9E31", text: "#3F7420", labelEn: "Good", labelFil: "Maayos" },
  FAIR: { fill: "#B87E00", text: "#8A5F00", labelEn: "Fair", labelFil: "Katamtaman" },
  NEEDS_ATTENTION: { fill: "#C75E1B", text: "#9C4204", labelEn: "Needs Attention", labelFil: "Kailangan ng Aksyon" },
  CRITICAL: { fill: "#B3261E", text: "#8F1D17", labelEn: "Critical", labelFil: "Delikado" },
};
export function bandInfo(band: string) {
  return BANDS[band] ?? BANDS.CRITICAL;
}
