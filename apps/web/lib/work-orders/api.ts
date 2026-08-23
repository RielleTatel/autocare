// Typed fetchers for the advisor work-order surfaces (W-05/W-06). All calls go
// through the same-origin BFF proxy which attaches the httpOnly session cookie.

export type WorkOrderStatus = "DRAFT" | "AWAITING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "QC" | "READY" | "CLOSED" | "CANCELLED";
export type ItemApproval = "PENDING" | "APPROVED" | "DECLINED" | "DEFERRED";

export type WorkOrderItem = {
  id: string;
  type: "PART" | "LABOR";
  partSku: string | null;
  partName: string | null;
  stockQty: number | null;
  description: string;
  qty: number;
  unitPriceCentavos: number;
  discountCentavos: number;
  lineTotalCentavos: number;
  approvalStatus: ItemApproval;
  recommendationId: string | null;
  recommendationLabel: string | null;
  severity: string | null;
  done: boolean;
};

export type WorkOrder = {
  id: string;
  number: string;
  vehicleId: string;
  plateNo?: string;
  status: WorkOrderStatus;
  customerComplaint: string | null;
  technicianSummary: string | null;
  openedAt: string;
  closedAt: string | null;
  items: WorkOrderItem[];
  wasteRecords: Array<{ id: string; wasteType: string; quantity: number; unit: string; haulerName: string | null; manifestNo: string | null }>;
  totals: { partsCentavos: number; laborCentavos: number; discountCentavos: number; approvedCentavos: number; grandTotalCentavos: number };
};

export type PartRow = { sku: string; name: string; category: string; costCentavos: number; priceCentavos: number; stockQty: number; reorderLevel: number; lowStock: boolean };
export type RecommendationRow = { id: string; pointCode: string; label: string; severity: string; recommendation: string; estimatedCostCentavos: number | null; status: string; resurfacedCount: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const detail = body?.error?.details?.wasteType ? ` (needs ${body.error.details.wasteType})` : "";
    throw new Error((body?.error?.message ?? `request failed (${res.status})`) + detail);
  }
  return body.data as T;
}

export const getWorkOrder = (id: string) => call<WorkOrder>(`work-orders/${id}`);
export const searchParts = (query: string) => call<PartRow[]>(`parts?query=${encodeURIComponent(query)}`);
export const getRecommendations = (vehicleId: string) => call<RecommendationRow[]>(`recommendations?vehicleId=${vehicleId}`);

export const addItem = (id: string, input: { type: "PART" | "LABOR"; partSku?: string; description: string; qty: number; unitPriceCentavos: number; discountCentavos?: number; recommendationId?: string }) =>
  call<WorkOrder & { addedItemId: string }>(`work-orders/${id}/items`, { method: "POST", body: JSON.stringify(input) });

export const requestApproval = (id: string) => call<WorkOrder>(`work-orders/${id}/request-approval`, { method: "POST" });

export const setStatus = (id: string, status: WorkOrderStatus, extra?: { technicianSummary?: string; stockOverrideReason?: string }) =>
  call<WorkOrder>(`work-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });

export const markDone = (id: string, itemId: string, done: boolean) =>
  call<WorkOrder>(`work-orders/${id}/items/${itemId}/done`, { method: "PATCH", body: JSON.stringify({ done }) });

export const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
