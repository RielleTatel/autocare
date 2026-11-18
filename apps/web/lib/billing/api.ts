import { staffApi } from "../staff-api";

export type CashShift = {
  id: string; userId: string; openedAt: string; closedAt: string | null;
  expectedCentavos: number; countedCentavos: number | null; varianceCentavos: number | null;
};
export type FinalBill = {
  id: string; number: string; subscriptionId: string | null; workOrderId: string | null;
  appointmentId?: string | null; vehicleId?: string; plateNo?: string; serviceName?: string;
  status: string; totalCentavos: number; issuedAt: string; dueDate: string;
  documentKind: "BILL" | "NO_CHARGE";
  items: Array<{ id?: string; description: string; qty: number; unitPriceCentavos: number; taxCentavos: number }>;
  payment: { method: string; status: string; tenderedCentavos: number | null; changeCentavos: number | null } | null;
};

export const isServiceBill = (bill: FinalBill) => !bill.subscriptionId && Boolean(bill.workOrderId || bill.appointmentId);
export const isNoCharge = (bill: FinalBill) => bill.documentKind === "NO_CHARGE";
export const canCollectCash = (bill: FinalBill) => isServiceBill(bill) && bill.totalCentavos > 0 && ["AWAITING_CASH", "GRACE", "PAST_DUE", "SUSPENDED"].includes(bill.status);
export const listFinalBills = () => staffApi<FinalBill[]>("invoices?scope=workshop");
export const getFinalBill = (id: string) => staffApi<FinalBill>(`invoices/${encodeURIComponent(id)}`);
export const getBillDocument = (id: string) => staffApi<{ url: string }>(`invoices/${encodeURIComponent(id)}/pdf`);
export const getCurrentCashShift = () => staffApi<CashShift | null>("cash-shifts/current");
export const openCashShift = () => staffApi<CashShift>("cash-shifts/open", { method: "POST" });
export const closeCashShift = (id: string, countedCentavos: number) => staffApi<CashShift>(`cash-shifts/${encodeURIComponent(id)}/close`, {
  method: "POST", body: JSON.stringify({ countedCentavos }),
});
export const recordCashPayment = (invoiceId: string, amountTendered: number, clientUuid: string) => staffApi<{ paymentId: string; changeCentavos: number }>("payments/cash", {
  method: "POST", headers: { "Idempotency-Key": clientUuid }, body: JSON.stringify({ invoiceId, amountTendered, clientUuid }),
});
