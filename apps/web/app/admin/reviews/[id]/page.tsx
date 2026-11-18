"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../../components/Button";
import { getBillingReview, issueFinalBill, returnBillingReview, type BillingReview } from "../../../../lib/billing/reviews";
import { errorMessage, formatPeso, parsePeso, pesoInput } from "../../../../lib/staff-api";

export default function BillingReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<BillingReview | null>(null);
  const [amount, setAmount] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");
  const [serviceReason, setServiceReason] = useState("");
  const [reason, setReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const apply = useCallback((next: BillingReview) => {
    setReview(next);
    setAmount(next.repair ? pesoInput(next.repair.finalRepairCentavos ?? next.repair.estimatedTotalCentavos) : "0.00");
    setServiceAmount(next.service.chargeCentavos == null ? "" : pesoInput(next.service.chargeCentavos));
    setServiceReason("");
  }, []);
  const load = useCallback(async () => { const next = await getBillingReview(id); apply(next); return next; }, [id, apply]);
  useEffect(() => { setReview(null); setError(null); void load().catch(e => setError(errorMessage(e))); }, [load]);

  async function issue() {
    if (!review || review.invoiceId) return;
    const finalRepair = review.repair ? parsePeso(amount) : 0;
    if (finalRepair === null) { setError("Enter the final repair amount in pesos, with up to two decimal places. Zero is allowed."); return; }
    const serviceCharge = needsServiceInput ? parsePeso(serviceAmount) : 0;
    if (serviceCharge === null) { setError("Enter the verified original service charge in pesos. Zero is allowed when the original visit was covered."); return; }
    const needsServiceReason = review.service.legacyProvenance || (review.service.chargeCentavos !== null && serviceCharge !== review.service.chargeCentavos);
    if (needsServiceReason && !serviceReason.trim()) { setError("Explain how the original service charge was verified or corrected."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      await issueFinalBill(id, review.version, review.repair ? finalRepair : undefined,
        needsServiceInput ? serviceCharge : undefined, needsServiceReason ? serviceReason.trim() : undefined);
      const current = await load();
      setMessage(current.invoiceId ? "Work verified and final bill issued." : "Review saved. Refresh to check the final bill.");
    } catch (e) {
      const failure = errorMessage(e);
      // Recover issue identity before allowing another command after an uncertain response.
      try { const current = await load(); if (current.invoiceId) setMessage("The final bill is issued. Open it below."); else setError(`${failure} Review the latest work before trying again.`); }
      catch { setError(`${failure} Refresh this review to confirm whether the bill was issued.`); }
    } finally { setBusy(false); }
  }
  async function sendBack() {
    if (!review || review.invoiceId) return;
    if (!reason.trim()) { setError("Explain what the mechanic needs to correct."); return; }
    setBusy(true); setError(null); setMessage(null);
    try { await returnBillingReview(id, review.version, reason.trim()); await load(); setReturnOpen(false); setReason(""); setMessage("Work returned for correction."); }
    catch (e) { const failure = errorMessage(e); try { await load(); } catch { /* Keep the current review visible for recovery. */ } setError(`${failure} Check the current review before trying again.`); }
    finally { setBusy(false); }
  }
  async function refresh() { setBusy(true); setError(null); try { await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }

  const repairAmount = review?.repair ? parsePeso(amount) : 0;
  const needsServiceInput = Boolean(review && (review.service.legacyProvenance || !review.service.covered));
  const serviceAmountCentavos = review ? needsServiceInput ? parsePeso(serviceAmount) : 0 : null;
  const needsServiceReason = Boolean(review && (review.service.legacyProvenance || (review.service.chargeCentavos !== null && serviceAmountCentavos !== null && serviceAmountCentavos !== review.service.chargeCentavos)));
  const total = review && repairAmount !== null && serviceAmountCentavos !== null ? serviceAmountCentavos + repairAmount : null;
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl text-ink">Verify work and billing</h1><div className="flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={busy} onClick={() => void refresh()}>Refresh review</Button><Link className="min-h-12 inline-flex items-center font-medium text-primary" href="/admin/reviews">Back to review queue</Link></div></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
    {!review && <div><p className="text-sm text-ink-muted">{error ? "Review could not be loaded." : "Loading work for review…"}</p>{error && <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>Try again</Button>}</div>}
    {review && <>
      <section className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
        <div><h2 className="font-display text-xl text-ink">{review.vehiclePlateNo} · {review.service.name}</h2><p className="text-sm text-ink-muted">{review.invoiceId ? "Final bill issued" : review.status.replaceAll("_", " ").toLowerCase()}</p></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Booked service price</dt><dd className="text-ink">{review.service.priceCentavos === null ? "Unavailable · legacy booking" : formatPeso(review.service.priceCentavos)}</dd></div><div><dt className="text-ink-muted">Original service charge for this bill</dt><dd className="text-ink">{review.service.chargeCentavos === null ? "Needs explicit review" : formatPeso(review.service.chargeCentavos)}{review.service.alreadyBilled ? " · Already billed" : review.service.legacyProvenance ? " · Price or coverage unverified" : review.service.covered ? " · Subscription covered" : ""}</dd></div></dl>
        {review.service.legacyProvenance && <p className="rounded-sm bg-chassis p-3 text-sm text-ink-muted">This older booking has no reliable price or coverage snapshot. Check the original records and enter the verified charge with a short note before issuing a bill.</p>}
        {review.service.previousInvoiceId && <Link className="min-h-10 inline-flex items-center text-sm font-medium text-primary" href={`/staff/billing/${review.service.previousInvoiceId}`}>View earlier service bill</Link>}
      </section>
      {review.repair ? <section className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
        <h2 className="font-display text-xl text-ink">Repair work</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Repair estimate</dt><dd className="text-ink">{formatPeso(review.repair.estimatedTotalCentavos)}</dd></div><div><dt className="text-ink-muted">Outcome</dt><dd className="text-ink">{review.repair.outcome.replaceAll("_", " ").toLowerCase()}</dd></div><div className="sm:col-span-2"><dt className="text-ink-muted">Repair notes</dt><dd className="whitespace-pre-wrap text-ink">{review.repair.notes}</dd></div>{review.repair.completedWorkNotes && <div className="sm:col-span-2"><dt className="text-ink-muted">Work actually completed</dt><dd className="whitespace-pre-wrap text-ink">{review.repair.completedWorkNotes}</dd></div>}{review.repair.completionNotes && <div className="sm:col-span-2"><dt className="text-ink-muted">Completion notes</dt><dd className="whitespace-pre-wrap text-ink">{review.repair.completionNotes}</dd></div>}<div><dt className="text-ink-muted">Mechanic recheck</dt><dd className="text-ink">{review.repair.rechecked ? "Confirmed" : "Not confirmed"}</dd></div></dl>
      </section> : <p className="text-sm text-ink-muted">This visit has no additional repair work. Review the original service charge before issue.</p>}
      {review.invoiceId ? <section className="rounded-md border border-line bg-surface p-5"><p className="text-sm text-ink">The issued amount is finalized.</p><Link className="mt-3 min-h-12 inline-flex items-center rounded-pill bg-primary px-6 font-semibold text-white" href={`/staff/billing/${review.invoiceId}`}>Open final bill</Link></section> : <section className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
        <h2 className="font-display text-xl text-ink">Final amount</h2>
        {needsServiceInput && <label className="flex max-w-xs flex-col gap-1 text-sm text-ink">{review.service.legacyProvenance ? "Verified original service charge (₱)" : "Original service charge (₱)"}<input required inputMode="decimal" value={serviceAmount} disabled={busy} onChange={event => setServiceAmount(event.target.value)} className="h-12 rounded-sm border border-line bg-chassis px-3 text-lg" /></label>}
        {needsServiceReason && <label className="flex flex-col gap-1 text-sm text-ink">How was this service charge verified?<textarea rows={2} required value={serviceReason} onChange={event => setServiceReason(event.target.value)} disabled={busy} className="rounded-sm border border-line bg-chassis p-3" /></label>}
        {review.repair && <label className="flex max-w-xs flex-col gap-1 text-sm text-ink">Additional repairs (₱)<input required inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} className="h-12 rounded-sm border border-line bg-chassis px-3 text-lg" /></label>}
        <p className="text-sm text-ink-muted">{review.repair?.outcome.toUpperCase().includes("STOP") ? "Include only the work actually performed. Unfinished repair findings remain open." : "Verify the performed work and original service coverage before issuing the final bill."}</p>
        <div className="flex items-center justify-between border-t border-line pt-4"><span className="font-medium text-ink">Final bill total</span><strong className="font-display text-2xl text-ink">{total === null ? "Enter a valid amount" : formatPeso(total)}</strong></div>
        {total === 0 && <p className="text-sm text-ink-muted">Issue a No charge document. No cash payment will be recorded.</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={busy || total === null} onClick={() => void issue()}>{busy ? "Saving review…" : total === 0 ? "Verify and issue No charge" : "Verify and issue final bill"}</Button><Button disabled={busy} variant="secondary" onClick={() => setReturnOpen(!returnOpen)}>{returnOpen ? "Cancel return" : "Return for correction"}</Button></div>
        {returnOpen && <form onSubmit={event => { event.preventDefault(); void sendBack(); }} className="flex flex-col gap-3 border-t border-line pt-4"><label className="flex flex-col gap-1 text-sm text-ink">What needs correction?<textarea rows={3} required value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="rounded-sm border border-line bg-chassis p-3" /></label><div><Button variant="secondary" type="submit" disabled={busy || !reason.trim()}>Send back to mechanic</Button></div></form>}
      </section>}
      <details className="rounded-md border border-line bg-surface p-4"><summary className="min-h-10 cursor-pointer font-medium text-ink">Review history</summary><ol className="mt-3 flex flex-col gap-4 text-sm">{review.history.map((entry, index) => <li key={`${entry.at}:${index}`}><p className="text-ink">{entry.action.replaceAll("_", " ").toLowerCase()} · {entry.actorName ?? "Staff"}</p><p className="text-ink-muted">{new Date(entry.at).toLocaleString("en-PH")}</p>{entry.notes && <p className="mt-1 whitespace-pre-wrap text-ink">{entry.notes}</p>}</li>)}{review.history.length === 0 && <li className="text-ink-muted">No admin review actions yet.</li>}</ol></details>
    </>}
  </div>;
}
