"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../../components/Button";
import { CashShiftPanel } from "../../../../components/CashShiftPanel";
import { canCollectCash, getBillDocument, getFinalBill, isNoCharge, isServiceBill, recordCashPayment, type CashShift, type FinalBill } from "../../../../lib/billing/api";
import { errorMessage, formatPeso, parsePeso, StaffApiError } from "../../../../lib/staff-api";

type CashAttempt = { clientUuid: string; amountTendered: number };

export function BillDetail({ id, collectorId }: { id: string; collectorId: string }) {
  const [bill, setBill] = useState<FinalBill | null>(null);
  const [shift, setShift] = useState<CashShift | null>(null);
  const [tendered, setTendered] = useState("");
  const [attempt, setAttempt] = useState<CashAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const operationKey = `autocare:cash:${collectorId}:${id}`;

  const load = useCallback(async () => {
    const next = await getFinalBill(id);
    if (!isServiceBill(next)) throw new Error("This bill is not a finalized service or repair bill. Open a bill from Cash bills.");
    setBill(next);
    setDocumentUrl(null);
    if (next.status === "PAID" || isNoCharge(next)) {
      setAttempt(null);
      try { sessionStorage.removeItem(operationKey); } catch { /* The server bill remains authoritative. */ }
    }
    return next;
  }, [id, operationKey]);
  useEffect(() => {
    setBill(null); setError(null); setDocumentUrl(null);
    try {
      const saved = JSON.parse(sessionStorage.getItem(operationKey) ?? "null") as CashAttempt | null;
      if (saved && typeof saved.clientUuid === "string" && Number.isSafeInteger(saved.amountTendered)) {
        setAttempt(saved); setTendered((saved.amountTendered / 100).toFixed(2));
      }
    } catch { /* The server bill remains authoritative if browser storage is unavailable. */ }
    void load().catch(e => setError(errorMessage(e)));
  }, [load, operationKey]);

  async function refresh() {
    setBusy(true); setError(null);
    try { await load(); } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function collect() {
    if (!bill || !shift || !collectorId || !canCollectCash(bill)) return;
    const amount = attempt?.amountTendered ?? parsePeso(tendered);
    if (amount === null || amount < bill.totalCentavos) { setError(`Enter at least ${formatPeso(bill.totalCentavos)} to pay the full bill.`); return; }
    const operation = attempt ?? { clientUuid: crypto.randomUUID(), amountTendered: amount };
    setAttempt(operation); setBusy(true); setError(null); setMessage(null); setDocumentUrl(null);
    // Retain the exact operation across a reload or an uncertain response.
    try { sessionStorage.setItem(operationKey, JSON.stringify(operation)); } catch { /* Keep the operation in memory. */ }
    try {
      const current = await load();
      if (!canCollectCash(current)) { setMessage(current.status === "PAID" ? "Payment is already recorded. Open the receipt below." : "This bill no longer needs a cash payment."); return; }
      const result = await recordCashPayment(id, operation.amountTendered, operation.clientUuid);
      const settled = await load();
      if (settled.status === "PAID") setMessage(`Cash recorded. Change: ${formatPeso(settled.payment?.changeCentavos ?? result.changeCentavos)}.`);
      else setError("The payment response was received, but this bill is not marked paid yet. Check bill status before trying again.");
    } catch (e) {
      setError(errorMessage(e));
      // A failed response is not evidence of a failed payment. Recover the exact bill.
      try {
        const recovered = await load();
        if (recovered.status === "PAID") {
          setError(null); setMessage("Payment is recorded. Open the receipt below to view the settled bill.");
        } else if (e instanceof StaffApiError && e.status >= 400 && e.status < 500 && e.status !== 409) {
          setAttempt(null); try { sessionStorage.removeItem(operationKey); } catch { /* Keep server recovery available. */ }
        }
      } catch { setError("Payment confirmation could not be checked. Keep this bill open and check its status before trying again."); }
    } finally { setBusy(false); }
  }
  async function document() {
    setBusy(true); setError(null);
    try { const result = await getBillDocument(id); setDocumentUrl(result.url); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  const amount = parsePeso(tendered);
  const paid = bill?.status === "PAID";
  const noCharge = bill ? isNoCharge(bill) : false;
  const cashPaid = paid && bill?.payment?.method === "CASH" && bill.payment.status === "SUCCEEDED";
  const documentLabel = noCharge ? "No charge document" : cashPaid ? "Cash receipt" : paid ? "Paid bill" : "Unpaid bill";
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl text-ink">{bill?.number ?? "Final bill"}</h1><Link href="/staff/billing" className="min-h-12 inline-flex items-center font-medium text-primary">Back to cash bills</Link></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {!bill && <div><p className="text-sm text-ink-muted">{error ? "The bill could not be loaded." : "Loading bill…"}</p>{error && <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>Try again</Button>}</div>}
    {bill && <>
      <section className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-display text-xl text-ink">{noCharge ? "No charge" : paid ? "Paid" : "Payment due"}</h2><p className="text-sm text-ink-muted">{bill.plateNo ? `${bill.plateNo} · ` : ""}{bill.serviceName ?? "Service and repair"}</p><p className="text-sm text-ink-muted">Issued {new Date(bill.issuedAt).toLocaleDateString("en-PH")}</p></div><p className="font-display text-3xl text-ink">{formatPeso(bill.totalCentavos)}</p></div>
        <dl className="divide-y divide-line">{bill.items.map((item, index) => <div key={item.id ?? index} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-ink">{item.description}{item.qty > 1 ? ` (×${item.qty})` : ""}</dt><dd className="shrink-0 text-ink">{formatPeso(item.qty * item.unitPriceCentavos)}</dd></div>)}</dl>
        {noCharge && <p className="text-sm text-ink-muted">No payment is required. No cash was collected for this document.</p>}
        {cashPaid && <dl className="grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Cash tendered</dt><dd className="text-ink">{bill.payment?.tenderedCentavos == null ? "See payment record" : formatPeso(bill.payment.tenderedCentavos)}</dd></div><div><dt className="text-ink-muted">Change</dt><dd className="text-ink">{bill.payment?.changeCentavos == null ? "See payment record" : formatPeso(bill.payment.changeCentavos)}</dd></div></dl>}
        <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={busy} onClick={() => void document()}>Prepare {documentLabel.toLowerCase()}</Button>{documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="min-h-12 inline-flex items-center font-medium text-primary underline">Open {documentLabel.toLowerCase()}</a>}<Button variant="ghost" disabled={busy} onClick={() => void refresh()}>Check bill status</Button></div>
      </section>
      {canCollectCash(bill) && <>
        <CashShiftPanel onChange={setShift} />
        <form className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4" onSubmit={event => { event.preventDefault(); void collect(); }}>
          <h2 className="font-display text-xl text-ink">Collect full cash payment</h2>
          {attempt && <p className="text-sm text-ink-muted">A payment attempt is saved for this bill. Check its status or retry the same amount to confirm it.</p>}
          <label className="flex max-w-xs flex-col gap-1 text-sm text-ink">Cash tendered (₱)<input inputMode="decimal" required disabled={busy || Boolean(attempt)} className="h-12 rounded-sm border border-line bg-chassis px-3 text-lg" value={tendered} onChange={event => setTendered(event.target.value)} /></label>
          {amount !== null && amount >= bill.totalCentavos && <p className="text-sm text-ink">Change: <strong>{formatPeso(amount - bill.totalCentavos)}</strong></p>}
          {!shift && <p className="text-sm text-ink-muted">Your cash shift must be open before collection.</p>}
          <div><Button type="submit" disabled={busy || !shift || !collectorId || amount === null || amount < bill.totalCentavos}>{busy ? "Checking payment…" : attempt ? "Retry saved cash payment" : `Record ${formatPeso(bill.totalCentavos)} cash`}</Button></div>
        </form>
      </>}
    </>}
  </div>;
}
