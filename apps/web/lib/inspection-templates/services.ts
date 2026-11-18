import { staffApi } from "../staff-api";

export type ConfiguredService = {
  id: string; code: string; name: string; standardDurationMin: number; requiredSkills: string[];
  priceCentavos: number; inspectionRequired: boolean; inspectionTemplateVersionId: string | null;
  inspectionConfigurationProblem?: string | null;
};
export type ServiceInput = Omit<ConfiguredService, "id" | "inspectionConfigurationProblem">;
export const listConfiguredServices = () => staffApi<ConfiguredService[]>("scheduling/service-types");
export const createConfiguredService = (input: ServiceInput) => staffApi<ConfiguredService>("scheduling/service-types", { method: "POST", body: JSON.stringify(input) });
export const updateConfiguredService = (id: string, input: ServiceInput) => staffApi<ConfiguredService>(`scheduling/service-types/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
