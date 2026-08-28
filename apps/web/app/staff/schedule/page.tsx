"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Board } from "./Board";
import { TodayPanel } from "./TodayPanel";
import { getBoard, cancelAppointment, type BoardAppointment } from "../../../lib/scheduling/api";

const todayManila = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export default function SchedulePage() {
  const [date, setDate] = useState(todayManila());
  const [appts, setAppts] = useState<BoardAppointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      setAppts(await getBoard(d, d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function onCancel(id: string) {
    try {
      await cancelAppointment(id);
      await load(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
      <div className="flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Schedule</h1>
          <Link href="/staff/config" className="text-primary text-sm font-medium">
            Capacity settings →
          </Link>
        </header>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} className="h-9 px-3 rounded-sm border border-line text-ink text-sm">
            ← Prev
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-3 rounded-sm border border-line bg-surface text-ink text-sm font-mono"
            aria-label="Board date"
          />
          <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} className="h-9 px-3 rounded-sm border border-line text-ink text-sm">
            Next →
          </button>
          <button type="button" onClick={() => setDate(todayManila())} className="h-9 px-3 rounded-sm border border-line text-ink text-sm">
            Today
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_300px]">
          <section className="flex flex-col gap-5">
            {error && <p className="text-danger text-sm">{error}</p>}
            {loading ? <p className="text-ink-muted text-sm py-8 text-center">Loading…</p> : <Board appointments={appts} onCancel={onCancel} />}
          </section>
          <TodayPanel appointments={appts} />
        </div>
      </div>
  );
}
