import { ApiClient } from "@autocare/api-client";

export type AttentionKind = "COMPONENT_STATUS" | "RECOMMENDATION" | "ENTITLEMENT_EXPIRING" | "SERVICE_DUE";
export type AttentionSeverity = "CRITICAL" | "ATTENTION" | "MONITOR" | "INFO";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  vehicleId: string;
  plate?: string;
  title: string;
  body: string;
  deepLink: { screen: string; params: Record<string, string> };
  createdAt: string;
};

export function makeAttentionApi(api: ApiClient) {
  return {
    mine: () => api.get<AttentionItem[]>("/me/attention"),
  };
}
export type AttentionApi = ReturnType<typeof makeAttentionApi>;
