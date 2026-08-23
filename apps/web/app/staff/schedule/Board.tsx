"use client";

import type { BoardAppointment } from "../../../lib/scheduling/api";

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

const STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-primary text-white",
  CONFIRMED: "bg-primary-deep text-white",
  IN_PROGRESS: "bg-band-good text-ink",
  COMPLETED: "bg-success text-white",
  CANCELLED: "bg-line text-ink-muted line-through",
  NO_SHOW: "bg-danger text-white",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? "bg-line text-ink"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/**
 * Day board — appointments grouped into hour rows, newest work at the top of each hour. Pure and
 * presentational; the page owns data-loading and mutations. Drag-to-move is a documented follow-up
 * (see the Phase 3 plan Task 6) — cancel/reschedule are wired via the row actions.
 */
export function Board({ appointments, onCancel }: { appointments: BoardAppointment[]; onCancel?: (id: string) => void }) {
  if (appointments.length === 0) {
    return <p className="text-ink-muted text-sm py-8 text-center">No appointments for this day.</p>;
  }

  const sorted = [...appointments].sort((x, y) => x.scheduledStart.localeCompare(y.scheduledStart));
  const groups: Array<{ hour: string; appts: BoardAppointment[] }> = [];
  for (const a of sorted) {
    const hour = manilaTime(a.scheduledStart).slice(0, 2) + ":00";
    const last = groups[groups.length - 1];
    if (last && last.hour === hour) last.appts.push(a);
    else groups.push({ hour, appts: [a] });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="board">
      {groups.map(({ hour, appts }) => (
        <section key={hour} className="grid grid-cols-[64px_1fr] gap-3">
          <div className="font-mono text-ink-muted text-sm pt-2">{hour}</div>
          <div className="flex flex-col gap-2">
            {appts.map((a) => (
              <article key={a.id} className="rounded-md border border-line bg-surface p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink text-sm font-semibold">{a.vehiclePlateNo}</span>
                    <StatusPill status={a.status} />
                    {a.requiresPickup && <span className="text-[11px] text-primary">pickup</span>}
                  </div>
                  <div className="text-ink text-sm mt-0.5">{a.serviceTypeName}</div>
                  <div className="text-ink-muted text-xs mt-0.5">
                    {manilaTime(a.scheduledStart)}–{manilaTime(a.scheduledEnd)}
                    {a.memberName ? ` · ${a.memberName}` : ""}
                  </div>
                </div>
                {onCancel && a.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={() => onCancel(a.id)}
                    className="shrink-0 h-8 px-2 rounded-sm border border-line text-danger text-xs font-medium"
                  >
                    Cancel
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
