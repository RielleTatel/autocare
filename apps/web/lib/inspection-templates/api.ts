import type { EditorCategory } from "../checklists/api";
import { staffApi } from "../staff-api";

export type TemplateVersion = {
  id: string; versionLabel: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null; categories?: EditorCategory[];
};
export type InspectionTemplate = { id: string; name: string; scope: "FULL" | "FOCUSED"; isActive: boolean; versions: TemplateVersion[] };
export const listInspectionTemplates = () => staffApi<InspectionTemplate[]>("admin/inspection-templates");
export const getInspectionTemplate = (id: string) => staffApi<InspectionTemplate>(`admin/inspection-templates/${encodeURIComponent(id)}`);
export const createInspectionTemplate = (name: string, scope: "FULL" | "FOCUSED") => staffApi<InspectionTemplate>("admin/inspection-templates", { method: "POST", body: JSON.stringify({ name, scope }) });
export const createTemplateVersion = (id: string, sourceVersionId?: string) => staffApi<InspectionTemplate>(`admin/inspection-templates/${encodeURIComponent(id)}/versions`, { method: "POST", body: JSON.stringify(sourceVersionId ? { sourceVersionId } : {}) });
export const saveTemplateVersion = (id: string, versionId: string, categories: EditorCategory[]) => staffApi<InspectionTemplate>(`admin/inspection-templates/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { method: "PATCH", body: JSON.stringify({ categories }) });
export const publishTemplateVersion = (id: string, versionId: string) => staffApi<InspectionTemplate>(`admin/inspection-templates/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/publish`, { method: "POST" });
