"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBays, getServiceTypes, createBay, createServiceType, upsertOperatingHours, type Bay, type ServiceType } from "../../../lib/scheduling/api";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export default function CapacityConfigPage() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [b, s] = await Promise.all([getBays(), getServiceTypes()]);
      setBays(b);
      setServiceTypes(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load config");
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    }
  };

  // Local form state
  const [bayName, setBayName] = useState("");
  const [bayCaps, setBayCaps] = useState("");
  const [stName, setStName] = useState("");
  const [stCode, setStCode] = useState("");
  const [stDur, setStDur] = useState(60);
  const [stSkills, setStSkills] = useState("");
  const [stPrice, setStPrice] = useState(50000);
  const [weekday, setWeekday] = useState<(typeof WEEKDAYS)[number]>("MON");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("17:00");
  const [buffer, setBuffer] = useState(10);

  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <main className="min-h-screen bg-chassis px-6 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Capacity settings</h1>
          <Link href="/staff/schedule" className="text-primary text-sm font-medium">
            ← Back to schedule
          </Link>
        </header>
        {msg && <p className="text-success text-sm">{msg}</p>}
        {err && <p className="text-danger text-sm">{err}</p>}

        <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">Bays</h2>
          <ul className="text-ink text-sm flex flex-wrap gap-2">
            {bays.map((b) => (
              <li key={b.id} className="rounded-sm border border-line px-2 py-1">
                {b.name} <span className="text-ink-muted font-mono text-xs">[{b.capabilities.join(", ")}]</span>
              </li>
            ))}
            {bays.length === 0 && <li className="text-ink-muted">None yet</li>}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <input value={bayName} onChange={(e) => setBayName(e.target.value)} placeholder="Bay name" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <input value={bayCaps} onChange={(e) => setBayCaps(e.target.value)} placeholder="capabilities (comma-sep)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <button type="button" onClick={() => guard(() => createBay(bayName, csv(bayCaps)), "Bay created")} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium">
              Add bay
            </button>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">Service types</h2>
          <ul className="text-ink text-sm flex flex-wrap gap-2">
            {serviceTypes.map((s) => (
              <li key={s.id} className="rounded-sm border border-line px-2 py-1">
                {s.name} <span className="text-ink-muted font-mono text-xs">{s.standardDurationMin}m</span>
              </li>
            ))}
            {serviceTypes.length === 0 && <li className="text-ink-muted">None yet</li>}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="Name" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <input value={stCode} onChange={(e) => setStCode(e.target.value)} placeholder="Code" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm font-mono" />
            <input type="number" value={stDur} onChange={(e) => setStDur(Number(e.target.value))} placeholder="Duration (min)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <input value={stSkills} onChange={(e) => setStSkills(e.target.value)} placeholder="required skills (comma-sep)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <input type="number" value={stPrice} onChange={(e) => setStPrice(Number(e.target.value))} placeholder="Price (centavos)" className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" />
            <button type="button" onClick={() => guard(() => createServiceType({ code: stCode, name: stName, standardDurationMin: stDur, requiredSkills: csv(stSkills), priceCentavos: stPrice }), "Service type created")} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium">
              Add service type
            </button>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">Operating hours (per weekday)</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={weekday} onChange={(e) => setWeekday(e.target.value as (typeof WEEKDAYS)[number])} className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm">
              {WEEKDAYS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm font-mono" aria-label="Open time" />
            <input type="time" value={close} onChange={(e) => setClose(e.target.value)} className="h-9 px-2 rounded-sm border border-line bg-chassis text-ink text-sm font-mono" aria-label="Close time" />
            <input type="number" value={buffer} min={0} max={100} onChange={(e) => setBuffer(Number(e.target.value))} className="h-9 w-20 px-2 rounded-sm border border-line bg-chassis text-ink text-sm" aria-label="Walk-in buffer percent" />
            <span className="text-ink-muted text-xs">% walk-in buffer</span>
            <button type="button" onClick={() => guard(() => upsertOperatingHours({ weekday, openTime: open, closeTime: close, walkInBufferPct: buffer }), "Hours saved")} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium">
              Save hours
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
