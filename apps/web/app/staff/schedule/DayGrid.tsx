"use client";

import type { BoardAppointment, Bay, Slot } from "../../../lib/scheduling/api";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { Plate } from "../../../components/Plate";
import { ApptStatus } from "./Board";

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Bay-by-time availability grid — the day's shape at a glance, not just what's
 * already booked. Rows come only from real data: appointment start times, plus
 * open-slot start times once a service type is chosen. There is no attempt to
 * reconstruct operating hours client-side (that logic already lives in the
 * capacity engine and has weekday/override precedence rules not worth
 * duplicating) — a time with nothing booked and no computed slot for the
 * selected service simply has no row.
 *
 * "Open" is deliberately per-service-type, not a generic bay-free flag: the
 * same bay/time can be open for one service and unstaffed for another,
 * because duration and required mechanic skill both vary by service. See
 * getSlots in lib/scheduling/api.ts.
 */
export function DayGrid({
  bays,
  appointments,
  slots,
  selectedServiceTypeName,
  onCancel,
}: {
  bays: Bay[];
  appointments: BoardAppointment[];
  slots: Slot[];
  selectedServiceTypeName?: string;
  onCancel?: (id: string) => void;
}) {
  if (bays.length === 0) {
    return <EmptyState title="No active bays configured" body="Add a bay under Capacity settings to see it here." />;
  }

  const rowTimes = Array.from(
    new Set([...appointments.map((a) => manilaTime(a.scheduledStart)), ...slots.map((s) => manilaTime(s.start))]),
  ).sort();

  if (rowTimes.length === 0) {
    return (
      <EmptyState
        title="Nothing to show for this day yet"
        body="Pick a service type above to see where it could still be booked, or check back once something's on the books."
      />
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="day-grid">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="w-16" />
            {bays.map((b) => (
              <th key={b.id} className="text-ink text-sm font-medium text-left px-2 pb-2">
                {b.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowTimes.map((time) => (
            <tr key={time}>
              <td className="font-mono text-ink-muted text-sm align-top pt-2 pr-2 whitespace-nowrap">{time}</td>
              {bays.map((b) => {
                const booked = appointments.find((a) => a.bayId === b.id && manilaTime(a.scheduledStart) === time);
                const open = !booked && slots.find((s) => s.bayId === b.id && manilaTime(s.start) === time);
                return (
                  <td key={b.id} className="align-top p-1 min-w-[180px]">
                    {booked ? (
                      <Card pad="md" className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Plate variant="plain" className="text-sm font-semibold">{booked.vehiclePlateNo}</Plate>
                          <ApptStatus status={booked.status} />
                        </div>
                        <div className="text-ink text-sm">{booked.serviceTypeName}</div>
                        {booked.memberName && <div className="text-ink-muted text-xs">{booked.memberName}</div>}
                        {onCancel && booked.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => onCancel(booked.id)}
                            className="self-start mt-1 h-8 px-2 rounded-sm border border-line text-danger text-xs font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </Card>
                    ) : open ? (
                      <div className="rounded-md border border-dashed border-line p-2 text-xs text-ink-muted">
                        <span className="font-medium text-primary">Open</span>
                        {selectedServiceTypeName && <div>{selectedServiceTypeName}</div>}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
