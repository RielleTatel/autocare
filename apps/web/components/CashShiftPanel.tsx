"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./Button";
import { closeCashShift, getCurrentCashShift, openCashShift, type CashShift } from "../lib/billing/api";
import { errorMessage, formatPeso, parsePeso } from "../lib/staff-api";

export function CashShiftPanel({ onChange }: { onChange?: (shift: CashShift | null) => void }) {
  const [shift, setShift] = useState<CashShift | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const current = await getCurrentCashShift();
      setShift(current); setReady(true); onChange?.(current);
    } catch (e) { setError(errorMessage(e)); setReady(false); onChange?.(null); }
  }, [onChange]);
  useEffect(() => { void load(); }, [load]);

  async function open() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const current = await openCashShift();
      setShift(current); onChange?.(current); setMessage("Cash shift opened.");
    } catch (e) { await load(); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function close() {
    const amount = parsePeso(counted);
    if (amount === null) { setError("Enter the cash counted in pesos, with up to two decimal places."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const closed = await closeCashShift(shift!.id, amount);
      setShift(null); onChange?.(null); setClosing(false); setCounted("");
      setMessage(`Shift closed. Expected ${formatPeso(closed.expectedCentavos)}. Counted ${formatPeso(closed.countedCentavos ?? 0)}. Variance ${formatPeso(closed.varianceCentavos ?? 0)}.`);
    } catch (e) { await load(); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3" aria-labelledby="cash-shift-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="cash-shift-heading" className="font-display text-lg text-ink">Your cash shift</h2>
        <p className="text-sm text-ink-muted">{!ready ? "Checking your shift…" : shift ? `Open since ${new Date(shift.openedAt).toLocaleString("en-PH")}` : "Open your shift before collecting cash."}</p>
      </div>
      {ready && !shift && <Button disabled={busy} onClick={() => void open()}>Open cash shift</Button>}
      {ready && shift && <Button variant="secondary" disabled={busy} onClick={() => setClosing(!closing)}>{closing ? "Keep shift open" : "Close cash shift"}</Button>}
    </div>
    {closing && shift && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void close(); }}>
      <label className="flex flex-col gap-1 text-sm text-ink">Cash counted (₱)<input className="h-12 rounded-sm border border-line bg-chassis px-3" inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} required /></label>
      <Button type="submit" disabled={busy}>Close and reconcile</Button>
    </form>}
    {error && <div role="alert" className="text-sm text-danger"><p>{error}</p>{!ready && <button className="mt-2 min-h-10 underline" type="button" onClick={() => void load()}>Check shift again</button>}</div>}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
  </section>;
}
