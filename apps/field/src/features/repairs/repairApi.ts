import { api } from "../../shared/api";
import type { PendingRepairAction } from "./repairDraft";

export type RepairStatus = "IN_PROGRESS" | "AWAITING_ADMIN_REVIEW" | "RETURNED_FOR_CORRECTION" | "VERIFIED" | "STOPPED";
export type RepairWorkOrder = {
  id: string;
  number: string;
  vehicleId: string;
  inspectionId: string;
  appointmentId: string | null;
  serviceTypeId: string | null;
  status: string;
  repairStatus: RepairStatus;
  version: number;
  notes: string;
  estimatedTotalCentavos: number;
  finalRepairCentavos: number | null;
  rechecked: boolean;
  completionNotes: string | null;
  completedWorkNotes: string | null;
  stopReason: string | null;
  reviewReason: string | null;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  returnAppointmentId: string | null;
  returnScheduledStart: string | null;
  returnScheduledEnd: string | null;
};

export type StartRepairInput = { clientUuid: string; notes: string; estimatedTotalCentavos: number };
export type UpdateRepairInput = { operationId: string; expectedVersion: number; notes: string; estimatedTotalCentavos: number };
export type CompleteRepairInput = { operationId: string; expectedVersion: number; rechecked: true; completionNotes?: string };
export type StopRepairInput = { operationId: string; expectedVersion: number; completedWorkNotes: string; reason: string };
export type RepairReturnSlot = { start: string; end: string; bayId: string; serviceTypeId: string };

export const getInspectionRepair = (inspectionId: string) =>
  api.get<RepairWorkOrder | null>(`/inspections/${encodeURIComponent(inspectionId)}/repair`);

export const getRepair = (workOrderId: string) =>
  api.get<RepairWorkOrder>(`/work-orders/${encodeURIComponent(workOrderId)}/repair`);

export const getRepairReturnSlots = (serviceTypeId: string, date: string) =>
  api.get<RepairReturnSlot[]>(`/scheduling/slots?serviceTypeId=${encodeURIComponent(serviceTypeId)}&from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`);

export async function acquireRepairReturnHold(slot: RepairReturnSlot): Promise<string> {
  const { holdId } = await api.post<{ holdId: string }>("/scheduling/holds", { bayId: slot.bayId, start: slot.start, serviceTypeId: slot.serviceTypeId });
  return holdId;
}

/** These actions use the new simple-total contract exclusively. There is no
 * fallback to structured lines, owner decisions or unrestricted status patches. */
export function sendRepairAction(inspectionId: string, request: PendingRepairAction): Promise<RepairWorkOrder> {
  if (request.action === "start") {
    return api.post<RepairWorkOrder>(`/inspections/${encodeURIComponent(inspectionId)}/repair`, request.payload as StartRepairInput);
  }
  if (!request.workOrderId) throw new Error("This repair action is missing its work order.");
  if (request.action === "update") {
    return api.patch<RepairWorkOrder>(`/work-orders/${encodeURIComponent(request.workOrderId)}/repair`, request.payload as UpdateRepairInput);
  }
  if (request.action === "schedule-return") {
    return api.post<RepairWorkOrder>(`/work-orders/${encodeURIComponent(request.workOrderId)}/repair/schedule-return`, request.payload);
  }
  if (request.action === "complete") {
    return api.post<RepairWorkOrder>(`/work-orders/${encodeURIComponent(request.workOrderId)}/repair/complete`, request.payload as CompleteRepairInput);
  }
  if (request.action === "stop") {
    return api.post<RepairWorkOrder>(`/work-orders/${encodeURIComponent(request.workOrderId)}/repair/stop`, request.payload as StopRepairInput);
  }
  throw new Error("This repair action is unavailable. Refresh the repair before continuing.");
}
