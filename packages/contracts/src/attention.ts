export const attentionKinds = ["COMPONENT_STATUS", "RECOMMENDATION", "ENTITLEMENT_EXPIRING", "SERVICE_DUE"] as const;
export type AttentionKind = (typeof attentionKinds)[number];

export const attentionSeverities = ["CRITICAL", "ATTENTION", "MONITOR", "INFO"] as const;
export type AttentionSeverity = (typeof attentionSeverities)[number];

/** A deep link the client resolves to one registered screen in one tap (FR-111). */
export interface AttentionDeepLink {
  screen: string;
  params: Record<string, string>;
}

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  vehicleId: string;
  /** Present only when the member has >1 vehicle (FR-110) — otherwise noise. */
  plate?: string;
  title: string;
  body: string;
  deepLink: AttentionDeepLink;
  createdAt: string;
}
