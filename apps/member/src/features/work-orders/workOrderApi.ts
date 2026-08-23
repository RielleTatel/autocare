import { ApiClient } from "@autocare/api-client";

export type ItemApproval = "PENDING" | "APPROVED" | "DECLINED" | "DEFERRED";
export type WorkOrderStatus = "DRAFT" | "AWAITING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "QC" | "READY" | "CLOSED" | "CANCELLED";

export type WorkOrderItem = {
  id: string;
  type: "PART" | "LABOR";
  partSku: string | null;
  partName: string | null;
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
  totals: { partsCentavos: number; laborCentavos: number; discountCentavos: number; approvedCentavos: number; grandTotalCentavos: number };
};

export type RecommendationRow = {
  id: string;
  vehicleId: string;
  pointCode: string;
  label: string;
  severity: string;
  recommendation: string;
  estimatedCostCentavos: number | null;
  status: string;
  resurfacedCount: number;
  createdAt: string;
};

/** Typed member work-order + recommendation calls on the shared `api` client. */
export function makeWorkOrderApi(api: ApiClient) {
  return {
    getWorkOrder: (id: string) => api.get<WorkOrder>(`/work-orders/${id}`),
    listForVehicle: (vehicleId: string) => api.get<WorkOrder[]>(`/vehicles/${vehicleId}/work-orders`),
    decide: (id: string, decisions: Array<{ itemId: string; decision: "APPROVED" | "DECLINED" | "DEFERRED" }>) =>
      api.post<WorkOrder>(`/work-orders/${id}/decisions`, { decisions }),
    getRecommendations: (vehicleId: string) => api.get<RecommendationRow[]>(`/recommendations?vehicleId=${vehicleId}`),
  };
}
export type WorkOrderApi = ReturnType<typeof makeWorkOrderApi>;

export const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
