"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addItem, addWaste, getRecommendations, getWorkOrder, markDone, peso, requestApproval, searchParts, setStatus,
  type PartRow, type RecommendationRow, type WorkOrder, type WorkOrderStatus,
} from "../../../../lib/work-orders/api";
import { quoteTotals } from "../../../../lib/work-orders/totals";

const STATUS_FLOW: WorkOrderStatus[] = ["DRAFT", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "QC", "READY", "CLOSED"];
const SEVERITY_COLOR: Record<string, string> = { CRITICAL: "#B3261E", ATTENTION: "#C75E1B", MONITOR: "#B87E00" };

/** W-05/W-06 — advisor quote builder + lifecycle controls. */
export default function WorkOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const w = await getWorkOrder(id);
    setWo(w);
    if (w.vehicleId) setRecs(await getRecommendations(w.vehicleId).catch(() => []));
  }, [id]);

  useEffect(() => {
    refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => (wo ? quoteTotals(wo.items) : null), [wo]);

  if (!wo || !totals) {
    return <p className="text-ink-muted text-sm">{err ?? "Loading…"}</p>;
  }

  const editable = wo.status === "DRAFT" || wo.status === "AWAITING_APPROVAL";
  const nextStatus = ((): WorkOrderStatus | null => {
    const i = STATUS_FLOW.indexOf(wo.status);
    return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
  })();

  return (
      <div className="flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-ink">Work order <span className="font-mono">{wo.number}</span></h1>
            {wo.plateNo && <span className="font-mono text-sm rounded-sm border border-line px-2 py-0.5 text-ink">{wo.plateNo}</span>}
            <StatusPill status={wo.status} />
          </div>
          <Link href="/staff/schedule" className="text-primary text-sm font-medium">← Schedule</Link>
        </header>

        {wo.customerComplaint && <p className="text-ink-muted text-sm">Complaint: “{wo.customerComplaint}”</p>}
        {err && <p className="text-danger text-sm" role="alert">{err}</p>}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
          <section className="flex flex-col gap-4">
            <ItemTable wo={wo} editable={editable} onMarkDone={(itemId, done) => guard(() => markDone(id, itemId, done))} />
            {editable && <AddItemForm workOrderId={id} onAdded={refresh} onError={setErr} />}
          </section>

          <aside className="flex flex-col gap-4">
            <TotalsPanel totals={totals} />
            {wo.status !== "CLOSED" && wo.status !== "CANCELLED" && (
              <WastePanel wo={wo} onAdd={(w) => guard(() => addWaste(id, w))} />
            )}
            {editable && recs.length > 0 && (
              <RecommendationsTray recs={recs} onConvert={(r) => guard(() =>
                addItem(id, { type: "PART", description: r.label, qty: 1, unitPriceCentavos: Math.round((r.estimatedCostCentavos ?? 0)), recommendationId: r.id }))} />
            )}
            <div className="rounded-md border border-line bg-surface p-4 flex flex-col gap-2">
              <h2 className="font-display text-lg text-ink">Lifecycle</h2>
              {wo.status === "DRAFT" && (
                <button type="button" disabled={busy} onClick={() => guard(() => requestApproval(id))} className="h-10 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
                  Request member approval
                </button>
              )}
              {nextStatus && wo.status !== "DRAFT" && wo.status !== "READY" && wo.status !== "AWAITING_APPROVAL" && (
                <button type="button" disabled={busy} onClick={() => guard(() => setStatus(id, nextStatus))} className="h-10 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
                  Advance to {nextStatus}
                </button>
              )}
              {wo.status === "AWAITING_APPROVAL" && (
                <button type="button" disabled={busy} onClick={() => guard(() => setStatus(id, "APPROVED"))} className="h-10 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
                  Mark approved (all lines decided)
                </button>
              )}
              {wo.status === "READY" && <CloseForm id={id} onClose={(summary) => guard(() => setStatus(id, "CLOSED", { technicianSummary: summary }))} />}
            </div>
          </aside>
        </div>
      </div>
  );
}

function StatusPill({ status }: { status: WorkOrderStatus }) {
  return <span className="rounded-pill bg-primary-deep text-white text-xs px-2 py-0.5">{status.replace("_", " ")}</span>;
}

function ItemTable({ wo, editable, onMarkDone }: { wo: WorkOrder; editable: boolean; onMarkDone: (itemId: string, done: boolean) => void }) {
  return (
    <div className="rounded-md border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm text-ink">
        <thead>
          <tr className="text-left text-ink-muted border-b border-line">
            <th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Unit</th><th className="p-2">Discount</th><th className="p-2">Line</th><th className="p-2">Decision</th><th className="p-2">Done</th>
          </tr>
        </thead>
        <tbody>
          {wo.items.map((i) => (
            <tr key={i.id} className="border-b border-line last:border-0">
              <td className="p-2">
                <div className="font-medium">{i.description}</div>
                <div className="text-ink-muted text-xs">{i.type === "PART" ? (i.partSku ? `${i.partSku} · stock ${i.stockQty}` : "part") : "labour"}{i.recommendationLabel ? " · from finding" : ""}</div>
              </td>
              <td className="p-2">{i.qty}</td>
              <td className="p-2">{peso(i.unitPriceCentavos)}</td>
              <td className="p-2">{i.discountCentavos ? `-${peso(i.discountCentavos)}` : "—"}</td>
              <td className="p-2 font-medium">{peso(i.lineTotalCentavos)}</td>
              <td className="p-2"><DecisionBadge status={i.approvalStatus} /></td>
              <td className="p-2">
                {!editable && i.approvalStatus === "APPROVED" ? (
                  <input aria-label={`${i.description} done`} type="checkbox" checked={i.done} onChange={(e) => onMarkDone(i.id, e.target.checked)} />
                ) : i.done ? "✓" : "—"}
              </td>
            </tr>
          ))}
          {wo.items.length === 0 && <tr><td colSpan={7} className="p-3 text-ink-muted">No line items yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const map: Record<string, string> = { PENDING: "text-ink-muted", APPROVED: "text-success", DECLINED: "text-danger", DEFERRED: "text-ink-muted" };
  return <span className={`text-xs font-medium ${map[status] ?? ""}`}>{status}</span>;
}

function TotalsPanel({ totals }: { totals: ReturnType<typeof quoteTotals> }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 flex flex-col gap-1 text-sm">
      <h2 className="font-display text-lg text-ink mb-1">Totals</h2>
      <Row label="Parts" value={peso(totals.partsCentavos)} />
      <Row label="Labour" value={peso(totals.laborCentavos)} />
      <Row label="Discounts" value={totals.discountCentavos ? `-${peso(totals.discountCentavos)}` : peso(0)} />
      <Row label="VAT (incl.)" value={peso(totals.vatCentavos)} muted />
      <div className="border-t border-line mt-1 pt-1"><Row label="Grand total" value={peso(totals.grandTotalCentavos)} bold /></div>
      <Row label="Approved so far" value={peso(totals.approvedCentavos)} muted />
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return <div className="flex justify-between"><span className={muted ? "text-ink-muted" : "text-ink"}>{label}</span><span className={`${bold ? "font-semibold" : ""} ${muted ? "text-ink-muted" : "text-ink"}`}>{value}</span></div>;
}

function RecommendationsTray({ recs, onConvert }: { recs: RecommendationRow[]; onConvert: (r: RecommendationRow) => void }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">Open findings</h2>
      {recs.map((r) => (
        <button key={r.id} type="button" onClick={() => onConvert(r)} className="text-left rounded-sm border border-line p-2 hover:bg-chassis">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[r.severity] ?? "#51616F" }} />
            <span className="text-ink text-sm font-medium">{r.label}</span>
            {r.resurfacedCount > 0 && <span className="text-xs text-danger">seen {r.resurfacedCount + 1}×</span>}
          </div>
          <div className="text-ink-muted text-xs">{r.recommendation}</div>
          <div className="text-primary text-xs mt-1">+ Add to quote</div>
        </button>
      ))}
    </div>
  );
}

function AddItemForm({ workOrderId, onAdded, onError }: { workOrderId: string; onAdded: () => Promise<void>; onError: (m: string) => void }) {
  const [type, setType] = useState<"PART" | "LABOR">("PART");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartRow[]>([]);
  const [selected, setSelected] = useState<PartRow | null>(null);
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (type !== "PART" || query.trim() === "") { setResults([]); return; }
    const t = setTimeout(() => { searchParts(query).then(setResults).catch(() => setResults([])); }, 200);
    return () => clearTimeout(t);
  }, [query, type]);

  const submit = async () => {
    try {
      await addItem(workOrderId, {
        type,
        partSku: type === "PART" ? selected?.sku : undefined,
        description: description || selected?.name || "",
        qty,
        unitPriceCentavos: type === "PART" && selected ? selected.priceCentavos : Math.round(price * 100),
      });
      setQuery(""); setSelected(null); setDescription(""); setQty(1); setPrice(0); setResults([]);
      await onAdded();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add item");
    }
  };

  return (
    <div className="rounded-md border border-line bg-surface p-4 flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">Add line</h2>
      <div className="flex gap-2">
        {(["PART", "LABOR"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`h-9 px-3 rounded-sm text-sm font-medium border ${type === t ? "bg-primary text-white border-primary" : "border-line text-ink"}`}>{t === "PART" ? "Part" : "Labour"}</button>
        ))}
      </div>
      {type === "PART" ? (
        <>
          <input aria-label="Search parts" value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }} placeholder="Search SKU or name…" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
          {results.map((p) => (
            <button key={p.sku} type="button" onClick={() => { setSelected(p); setQuery(p.name); setResults([]); }} className="text-left rounded-sm border border-line p-2 hover:bg-chassis text-sm">
              <span className="text-ink">{p.name}</span> <span className="text-ink-muted font-mono text-xs">{p.sku} · {peso(p.priceCentavos)} · stock {p.stockQty}{p.lowStock ? " ⚠ low" : ""}</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <input aria-label="Labour description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Labour description" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
          <input aria-label="Labour price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="Price (₱)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
        </>
      )}
      <div className="flex items-center gap-2">
        <label className="text-ink-muted text-sm">Qty</label>
        <input aria-label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="h-9 w-16 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
        <button type="button" onClick={submit} disabled={type === "PART" ? !selected : description.trim() === ""} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50 ml-auto">Add</button>
      </div>
    </div>
  );
}

const WASTE_UNITS: Record<string, string> = { USED_OIL: "L", COOLANT: "L", BATTERY: "pcs", FILTER: "pcs", TIRE: "pcs" };

function WastePanel({ wo, onAdd }: { wo: WorkOrder; onAdd: (input: { wasteType: string; quantity: number; unit: string; haulerName?: string; manifestNo?: string }) => void }) {
  const [wasteType, setWasteType] = useState("USED_OIL");
  const [quantity, setQuantity] = useState("");
  const [hauler, setHauler] = useState("");
  const [manifest, setManifest] = useState("");
  const unit = WASTE_UNITS[wasteType];

  return (
    <div className="rounded-md border border-line bg-surface p-4 flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">Hazardous waste (W-09)</h2>
      {wo.wasteRecords.map((w) => (
        <div key={w.id} className="text-sm text-ink flex justify-between border-b border-line pb-1">
          <span>{w.wasteType.replace("_", " ")} — {w.quantity} {w.unit}</span>
          {w.manifestNo && <span className="text-ink-muted font-mono text-xs">{w.manifestNo}</span>}
        </div>
      ))}
      <select aria-label="Waste type" value={wasteType} onChange={(e) => setWasteType(e.target.value)} className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm">
        {Object.keys(WASTE_UNITS).map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
      </select>
      <div className="flex gap-2 items-center">
        <input aria-label="Waste quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm flex-1" />
        <span className="text-ink-muted text-sm">{unit}</span>
      </div>
      <input aria-label="Hauler name" value={hauler} onChange={(e) => setHauler(e.target.value)} placeholder="Hauler (optional)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
      <input aria-label="Manifest number" value={manifest} onChange={(e) => setManifest(e.target.value)} placeholder="Manifest # (optional)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
      <button type="button" disabled={quantity.trim() === "" || Number(quantity) <= 0} onClick={() => { onAdd({ wasteType, quantity: Number(quantity), unit, haulerName: hauler || undefined, manifestNo: manifest || undefined }); setQuantity(""); setHauler(""); setManifest(""); }} className="h-9 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
        Record waste
      </button>
    </div>
  );
}

function CloseForm({ id, onClose }: { id: string; onClose: (summary: string) => void }) {
  const [summary, setSummary] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <textarea aria-label="Technician summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Technician summary (required to close)" rows={3} className="rounded-sm border border-line bg-chassis text-ink text-sm p-2" />
      <button type="button" disabled={summary.trim() === ""} onClick={() => onClose(summary)} className="h-10 rounded-sm bg-success text-white text-sm font-medium disabled:opacity-50">Close work order</button>
    </div>
  );
}
