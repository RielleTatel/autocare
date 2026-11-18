"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CashShiftPanel } from "../../../components/CashShiftPanel";
import { Button } from "../../../components/Button";
import { isNoCharge, isServiceBill, listFinalBills, type FinalBill } from "../../../lib/billing/api";
import { errorMessage, formatPeso } from "../../../lib/staff-api";

export default function CashBillsPage() {
  const [bills, setBills] = useState<FinalBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setBills((await listFinalBills()).filter(isServiceBill)); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl text-ink">Cash bills</h1><p className="mt-1 text-sm text-ink-muted">Final service and repair bills ready for collection.</p></div><Button variant="secondary" onClick={() => void load()}>Refresh bills</Button></header>
    <CashShiftPanel />
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!bills && !error && <p className="text-sm text-ink-muted" role="status">Loading final bills…</p>}
    {bills && <section className="divide-y divide-line rounded-md border border-line bg-surface" aria-label="Final bills">
      {bills.map(bill => <Link key={bill.id} href={`/staff/billing/${bill.id}`} className="flex min-h-20 flex-wrap items-center justify-between gap-3 p-4 hover:bg-chassis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div><p className="font-medium text-ink">{bill.number}{bill.plateNo ? ` · ${bill.plateNo}` : ""}</p><p className="text-sm text-ink-muted">{bill.serviceName ?? "Service and repair"} · Issued {new Date(bill.issuedAt).toLocaleDateString("en-PH")}</p></div>
        <div className="text-right"><p className="font-medium text-ink">{formatPeso(bill.totalCentavos)}</p><p className={`text-sm ${bill.status === "PAID" || isNoCharge(bill) ? "text-success" : "text-ink-muted"}`}>{isNoCharge(bill) ? "No charge" : bill.status === "PAID" ? "Paid" : "Payment due"}</p></div>
      </Link>)}
      {bills.length === 0 && <p className="p-5 text-sm text-ink-muted">No final service or repair bills yet. Bills appear after admin review.</p>}
    </section>}
  </div>;
}
