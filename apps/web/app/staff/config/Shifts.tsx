"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getShifts, createShift, updateShift, deleteShift, getRosterableStaff,
  type Shift, type RosterableStaff,
} from "../../../lib/scheduling/api";
import { Button } from "../../../components/Button";

const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const daysFrom = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric",
  });

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/**
 * The roster — who is working, when.
 *
 * This is the control that actually governs how early and how late the shop can
 * be booked: the capacity engine only offers a slot when a qualified mechanic's
 * shift fully covers it, so extending operating hours without extending a shift
 * changes nothing. That relationship is easy to get wrong, so the empty state
 * and the hint below say it outright.
 */
export function Shifts({ onError, onMessage }: { onError(m: string): void; onMessage(m: string): void }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<RosterableStaff[]>([]);
  const [days, setDays] = useState(14);
  const [editing, setEditing] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("09:00");
  const [editEnd, setEditEnd] = useState("18:00");

  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(manilaToday());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [skills, setSkills] = useState("GENERAL");

  const refresh = useCallback(async () => {
    try {
      const [s, people] = await Promise.all([getShifts(manilaToday(), daysFrom(days)), getRosterableStaff()]);
      setShifts(s);
      setStaff(people);
      if (!userId && people.length > 0) setUserId(people[0].id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load the roster");
    }
    // onError is a parent callback recreated each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => { void refresh(); }, [refresh]);

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      onMessage(ok);
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const byDate = shifts.reduce<Map<string, Shift[]>>((acc, s) => {
    acc.set(s.date, [...(acc.get(s.date) ?? []), s]);
    return acc;
  }, new Map());

  return (
    <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-ink">Shifts</h2>
        <label className="text-ink-muted text-xs flex items-center gap-2">
          Showing
          <select
            aria-label="Roster window"
            className="rounded-sm border border-line bg-surface px-2 py-1 text-ink"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>next 7 days</option>
            <option value={14}>next 14 days</option>
            <option value={30}>next 30 days</option>
          </select>
        </label>
      </div>

      <p className="text-ink-muted text-xs">
        A time is only bookable when a qualified mechanic is on shift for the whole of it —
        extending opening hours without extending a shift adds no capacity.
      </p>

      {shifts.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Nobody is rostered in this window, so no appointments can be booked. Add a shift below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {Array.from(byDate.entries()).map(([d, rows]) => (
            <li key={d} className="flex flex-col gap-1">
              <div className="text-ink-muted text-xs font-medium">{dateLabel(d)}</div>
              <ul className="flex flex-col gap-1">
                {rows.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-sm border border-line px-2 py-1 text-sm">
                    <span className="text-ink min-w-0 flex-1 truncate">{s.userName ?? s.userEmail ?? "Unnamed"}</span>
                    {editing === s.id ? (
                      <>
                        <input aria-label="Shift start" type="time" className="rounded-sm border border-line px-1" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                        <input aria-label="Shift end" type="time" className="rounded-sm border border-line px-1" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                        <Button onClick={() => guard(async () => { await updateShift(s.id, { startTime: editStart, endTime: editEnd }); setEditing(null); }, "Shift updated")}>Save</Button>
                        <button type="button" className="text-ink-muted text-xs" onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-ink-muted">{timeLabel(s.startTime)}–{timeLabel(s.endTime)}</span>
                        <span className="text-ink-muted text-xs">{s.skills.join(", ") || "no skills"}</span>
                        <button
                          type="button"
                          className="text-primary text-xs"
                          aria-label={`Edit shift for ${s.userName ?? "staff"} on ${s.date}`}
                          onClick={() => { setEditing(s.id); setEditStart(s.startTime); setEditEnd(s.endTime); }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-danger text-xs"
                          aria-label={`Remove shift for ${s.userName ?? "staff"} on ${s.date}`}
                          onClick={() => guard(() => deleteShift(s.id), "Shift removed")}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <label className="text-ink-muted text-xs flex flex-col gap-1">
          Who
          <select aria-label="Staff member" className="rounded-sm border border-line bg-surface px-2 py-1 text-ink" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {staff.length === 0 && <option value="">No staff yet</option>}
            {staff.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? "Unnamed"} · {p.role}</option>
            ))}
          </select>
        </label>
        <label className="text-ink-muted text-xs flex flex-col gap-1">
          Date
          <input aria-label="Shift date" type="date" className="rounded-sm border border-line bg-surface px-2 py-1 text-ink" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-ink-muted text-xs flex flex-col gap-1">
          Starts
          <input aria-label="Start time" type="time" className="rounded-sm border border-line bg-surface px-2 py-1 text-ink" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="text-ink-muted text-xs flex flex-col gap-1">
          Ends
          <input aria-label="End time" type="time" className="rounded-sm border border-line bg-surface px-2 py-1 text-ink" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="text-ink-muted text-xs flex flex-col gap-1 col-span-2">
          Skills (comma separated — must cover the service&apos;s required skills)
          <input aria-label="Skills" className="rounded-sm border border-line bg-surface px-2 py-1 text-ink" value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
        <div className="col-span-2">
          <Button
            disabled={!userId}
            onClick={() => guard(() => createShift({ userId, date, startTime: start, endTime: end, skills: csv(skills) }), "Shift added")}
          >
            Add shift
          </Button>
        </div>
      </div>
    </section>
  );
}
