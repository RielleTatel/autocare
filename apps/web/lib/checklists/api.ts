// Typed fetchers for the checklist admin surfaces (A-04/A-05). All calls go
// through the same-origin BFF proxy which attaches the httpOnly session cookie.

export type Thresholds = { direction: "HIGHER_BETTER" | "LOWER_BETTER"; good: number; monitor: number; attention: number };
export type EditorPoint = {
  code: string; label: string; labelFil?: string; weightInCategory: number;
  isSafetyCritical: boolean; inputType: "STATUS" | "MEASURED"; unit?: string;
  thresholds?: Thresholds; recommendation: string; templates?: Record<string, string>;
  requiresPhotoOnAdverse?: boolean; notApplicableWhen?: string;
};
export type EditorCategory = { code: string; label: string; labelFil?: string; weight: number; points: EditorPoint[] };
export type ChecklistVersionSummary = {
  id: string; versionLabel: string; weightVersion: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isActive: boolean; publishedAt: string | null;
};
export type ChecklistVersionFull = ChecklistVersionSummary & { categories: EditorCategory[] };
export type PreviewResult = {
  score: number; rawScore: number; band: string; confidence: string;
  overrideApplied: string;
  categoryScores: Array<{ categoryCode: string; label: string; score: number; weight: number }>;
  topDetractors: Array<{ pointCode: string; label: string; status: string; scoreImpact: number; recommendation: string }>;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const detail = body?.error?.details?.problems?.join("; ");
    throw new Error(detail ?? body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

export const listChecklists = () => call<ChecklistVersionSummary[]>("admin/checklists");
export const getChecklist = (id: string) => call<ChecklistVersionFull>(`admin/checklists/${id}`);
export const getActiveChecklist = () => call<ChecklistVersionFull>("checklists/active");
export const createDraft = () => call<ChecklistVersionSummary>("admin/checklists", { method: "POST" });
export const patchDraft = (id: string, categories: EditorCategory[]) =>
  call<ChecklistVersionFull>(`admin/checklists/${id}`, { method: "PATCH", body: JSON.stringify({ categories }) });
export const publishChecklist = (id: string) =>
  call<ChecklistVersionSummary>(`admin/checklists/${id}/publish`, { method: "POST" });
export const previewScore = (id: string, results: Array<{ pointCode: string; status?: string; measuredValue?: number }>) =>
  call<PreviewResult>(`admin/checklists/${id}/preview-score`, { method: "POST", body: JSON.stringify({ results, daysSinceInspection: 0 }) });
