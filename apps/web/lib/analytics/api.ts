// Admin dashboard fetchers. Through the BFF proxy, which attaches the session cookie.

export type AnalyticsSummary = {
  /** Decimal string — centavos are bigint server-side and JSON has no bigint. */
  mrrCentavos: string;
  activeMembers: number;
  churn30d: number;
  bayUtilisation: number;
};

export type WasteSummary = {
  totals: Array<{ wasteType: string; quantity: number; unit: string }>;
  recordCount: number;
  lastExportedAt: string | null;
};

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

export const getAnalyticsSummary = () => call<AnalyticsSummary>("admin/analytics/summary");
export const getWasteSummary = (from: string, to: string) =>
  call<WasteSummary>(`admin/waste/summary?from=${from}&to=${to}`);
