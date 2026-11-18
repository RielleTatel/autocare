import { ApiClient } from "@autocare/api-client";
import type { Invoice } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import type { InspectionDetail } from "../health-score/healthScoreApi";

export type InspectionScope = "FULL" | "FOCUSED" | "LEGACY_UNKNOWN";
export type InspectionSummary = {
  id: string;
  vehicleId: string;
  appointmentId: string | null;
  submittedAt: string | null;
  odometerKm: number | null;
  scope: InspectionScope;
  templateName?: string | null;
  serviceName?: string | null;
  score?: number | null;
  band?: Band | null;
  invoiceId?: string | null;
};
export type ScopedInspectionDetail = InspectionDetail & InspectionSummary & {
  observations?: Array<{ id: string; notes: string; photoUrls: string[] }>;
};
export type RepairStatus = "IN_PROGRESS" | "AWAITING_ADMIN_REVIEW" | "RETURNED_FOR_CORRECTION" | "PAYMENT_DUE" | "PAID" | "STOPPED" | "NO_CHARGE";
export type RepairSummary = {
  id: string;
  vehicleId: string;
  inspectionId: string;
  appointmentId?: string | null;
  number: string;
  status: RepairStatus;
  repairNotes: string;
  estimatedTotalCentavos: number;
  openedAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  stoppedAt?: string | null;
  completionNotes?: string | null;
  stopReason?: string | null;
  completedWorkNotes?: string | null;
  recheckedAt?: string | null;
  returnScheduledStart?: string | null;
  invoiceId?: string | null;
};

/** Service documents are read-only; subscription checkout remains a separate flow. */
export type ServiceDocument = Omit<Invoice, "status" | "payment"> & {
  status: string;
  vehicleId?: string | null;
  workOrderId?: string | null;
  appointmentId?: string | null;
  documentKind?: "BILL" | "NO_CHARGE";
  payment?: { method: string; status: string; tenderedCentavos?: number | null; changeCentavos?: number | null } | null;
};

export function makeServiceHistoryApi(api: ApiClient) {
  return {
    listInspections: (vehicleId: string) => api.get<InspectionSummary[]>(`/vehicles/${vehicleId}/inspections`),
    getInspection: (vehicleId: string, inspectionId: string) => api.get<ScopedInspectionDetail>(`/vehicles/${vehicleId}/inspections/${inspectionId}`),
    listRepairs: (vehicleId: string) => api.get<RepairSummary[]>(`/vehicles/${vehicleId}/repair-work-orders`),
    getDocument: (invoiceId: string) => api.get<ServiceDocument>(`/invoices/${invoiceId}`),
    getDocumentPdf: (invoiceId: string) => api.get<{ url: string }>(`/invoices/${invoiceId}/pdf`),
  };
}

export const scopeLabel = (scope: InspectionScope | undefined) => scope === "FULL" ? "Full inspection" : scope === "FOCUSED" ? "Focused inspection" : "Inspection · scope unverified";
export const serviceDate = (value: string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });
export const repairStatusLabel = (status: RepairStatus): string => ({
  IN_PROGRESS: "Repair in progress",
  AWAITING_ADMIN_REVIEW: "Awaiting admin review",
  RETURNED_FOR_CORRECTION: "Returned for correction",
  PAYMENT_DUE: "Payment due",
  PAID: "Paid",
  STOPPED: "Repair stopped · awaiting admin review",
  NO_CHARGE: "No charge",
})[status] ?? "Repair status unavailable";

export function documentState(document: ServiceDocument) {
  if (document.documentKind === "NO_CHARGE" || document.status === "NO_CHARGE") return "No charge";
  if (document.status === "PAID") return "Paid";
  return "Payment due";
}
