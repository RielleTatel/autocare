import { staffApi } from "../staff-api";

export type BillingReview = {
  appointmentId: string; version: number; vehicleId: string; vehiclePlateNo: string;
  service: { name: string; priceCentavos: number | null; covered: boolean; legacyProvenance: boolean; chargeCentavos: number | null; alreadyBilled: boolean; previousInvoiceId: string | null };
  repair: {
    id: string; notes: string; estimatedTotalCentavos: number; completedWorkNotes: string | null;
    completionNotes: string | null; outcome: string; rechecked: boolean; finalRepairCentavos: number | null;
  } | null;
  status: string; invoiceId: string | null;
  history: Array<{ action: string; actorName: string | null; at: string; notes: string | null }>;
};
const reviewPath = (id: string) => `admin/final-billing/reviews/${encodeURIComponent(id)}`;
export const listBillingReviews = () => staffApi<BillingReview[]>("admin/final-billing/reviews");
export const getBillingReview = (id: string) => staffApi<BillingReview>(reviewPath(id));
export const returnBillingReview = (id: string, expectedVersion: number, reason: string) => staffApi<BillingReview>(`${reviewPath(id)}/return`, {
  method: "POST", body: JSON.stringify({ expectedVersion, reason }),
});
export const issueFinalBill = (id: string, expectedVersion: number, finalRepairCentavos?: number, serviceChargeCentavos?: number, serviceChargeReason?: string) => staffApi<BillingReview>(`${reviewPath(id)}/issue`, {
  method: "POST", body: JSON.stringify({ expectedVersion, ...(finalRepairCentavos !== undefined ? { finalRepairCentavos } : {}),
    ...(serviceChargeCentavos !== undefined ? { serviceChargeCentavos } : {}), ...(serviceChargeReason ? { serviceChargeReason } : {}) }),
});
