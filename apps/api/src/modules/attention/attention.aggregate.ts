import type { AttentionItem, AttentionSeverity } from "@autocare/contracts";

/** Raw inputs to the aggregator — one array per feed, already scoped to the
 *  member's vehicles. Kept as plain data so the merge/sort logic is a pure,
 *  DB-free function (each feed's mapper is separate; adding a fifth feed later
 *  never touches the others). */
export interface AttentionInputs {
  /** ATTENTION/CRITICAL component findings from the latest score per vehicle. */
  componentFindings: Array<{ vehicleId: string; categoryCode: string; pointCode: string; label: string; severity: "ATTENTION" | "CRITICAL"; inspectionId: string; createdAt: Date }>;
  /** Open recommendations. */
  recommendations: Array<{ id: string; vehicleId: string; label: string; recommendation: string; severity: "MONITOR" | "ATTENTION" | "CRITICAL"; createdAt: Date }>;
  /** Entitlements with quota left, whose period ends soon. */
  entitlementsExpiring: Array<{ vehicleId: string; subscriptionId: string; entitlementType: string; remaining: number; daysToExpiry: number; periodEnd: Date }>;
  /** Appointments/services due or overdue. */
  servicesDue: Array<{ vehicleId: string; serviceTypeId: string; serviceTypeName: string; dueDate: Date; overdue: boolean }>;
  /** vehicleId → plate, used only when the member has >1 vehicle. */
  plates: Map<string, string>;
  multiVehicle: boolean;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { CRITICAL: 0, ATTENTION: 1, MONITOR: 2, INFO: 3 };

function withPlate(item: AttentionItem, plates: Map<string, string>, multi: boolean): AttentionItem {
  if (multi) return { ...item, plate: plates.get(item.vehicleId) };
  return item;
}

export function aggregateAttention(inputs: AttentionInputs): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const f of inputs.componentFindings) {
    items.push({
      id: `component:${f.vehicleId}:${f.pointCode}`,
      kind: "COMPONENT_STATUS",
      severity: f.severity,
      vehicleId: f.vehicleId,
      title: f.label,
      body: f.severity === "CRITICAL" ? `${f.label} is in unsafe condition.` : `${f.label} needs attention.`,
      deepLink: { screen: "CategoryBreakdown", params: { vehicleId: f.vehicleId, category: f.categoryCode } },
      createdAt: f.createdAt.toISOString(),
    });
  }

  for (const r of inputs.recommendations) {
    items.push({
      id: `recommendation:${r.id}`,
      kind: "RECOMMENDATION",
      severity: r.severity,
      vehicleId: r.vehicleId,
      title: r.label,
      body: r.recommendation,
      deepLink: { screen: "Recommendations", params: { vehicleId: r.vehicleId, recommendationId: r.id } },
      createdAt: r.createdAt.toISOString(),
    });
  }

  for (const e of inputs.entitlementsExpiring) {
    items.push({
      id: `entitlement:${e.subscriptionId}:${e.entitlementType}`,
      kind: "ENTITLEMENT_EXPIRING",
      severity: "INFO",
      vehicleId: e.vehicleId,
      title: `${e.remaining} ${labelForEntitlement(e.entitlementType)} left`,
      body: `Use ${e.remaining > 1 ? "them" : "it"} before your benefits reset in ${e.daysToExpiry} day${e.daysToExpiry === 1 ? "" : "s"}.`,
      deepLink: { screen: "SubscriptionDashboard", params: { subscriptionId: e.subscriptionId } },
      createdAt: e.periodEnd.toISOString(),
    });
  }

  for (const s of inputs.servicesDue) {
    items.push({
      id: `service:${s.vehicleId}:${s.serviceTypeId}`,
      kind: "SERVICE_DUE",
      severity: s.overdue ? "ATTENTION" : "MONITOR",
      vehicleId: s.vehicleId,
      title: `${s.serviceTypeName} ${s.overdue ? "overdue" : "due soon"}`,
      body: s.overdue ? `This service was due on ${s.dueDate.toLocaleDateString()}.` : `Due around ${s.dueDate.toLocaleDateString()}.`,
      deepLink: { screen: "Booking", params: { vehicleId: s.vehicleId, serviceTypeId: s.serviceTypeId } },
      createdAt: s.dueDate.toISOString(),
    });
  }

  // CRITICAL-first, then most recent first (FR-110).
  items.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return items.map((i) => withPlate(i, inputs.plates, inputs.multiVehicle));
}

function labelForEntitlement(type: string): string {
  const map: Record<string, string> = {
    INSPECTION: "inspection", PICKUP: "pickup", ROADSIDE: "roadside call",
    OIL_CHANGE: "oil change", TIRE_ROTATION: "tyre rotation",
  };
  return map[type] ?? type.toLowerCase().replace("_", " ");
}
