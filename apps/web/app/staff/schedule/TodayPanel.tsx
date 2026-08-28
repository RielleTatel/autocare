"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/Card";
import { getBays, getOperatingHours, type BoardAppointment } from "../../../lib/scheduling/api";

/** A cancelled or no-show slot is not occupying a bay. */
const OCCUPIES = (status: string) => status !== "CANCELLED" && status !== "NO_SHOW";

/** The advisor's at-a-glance state of the day, beside the board. */
export function TodayPanel({ appointments }: { appointments: BoardAppointment[] }) {
  const [bayCount, setBayCount] = useState<number | null>(null);
  const [bufferPct, setBufferPct] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getBays().then((b) => { if (live) setBayCount(b.length); }).catch(() => undefined);
    getOperatingHours()
      .then((h) => { if (live && h.length > 0) setBufferPct(h[0].walkInBufferPct); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  const booked = appointments.length;
  const baysInUse = new Set(
    appointments.filter((a) => OCCUPIES(a.status) && a.bayId).map((a) => a.bayId),
  ).size;
  const pickups = appointments.filter((a) => a.requiresPickup && OCCUPIES(a.status)).length;

  const rows: Array<[string, string]> = [
    ["Booked", String(booked)],
    ["Bays in use", bayCount === null ? "—" : `${baysInUse} of ${bayCount}`],
    ["Walk-in buffer", bufferPct === null ? "—" : `${bufferPct}%`],
    ["Pick-ups", String(pickups)],
  ];

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Today</h2>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-t border-line py-1.5 text-sm">
          <span className="text-ink-muted">{label}</span>
          <span className="font-mono tabular-nums text-ink">{value}</span>
        </div>
      ))}
    </Card>
  );
}
