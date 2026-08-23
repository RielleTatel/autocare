/**
 * Asia/Manila (UTC+08:00, no DST) date/time helpers shared across the scheduling module. Slot
 * arithmetic is done on `YYYY-MM-DD` + `HH:mm` strings; the DB stores `scheduledStart/End` as real
 * `DateTime`s, so we convert at the boundary with a fixed +08:00 offset.
 */
export const MANILA_OFFSET = "+08:00";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];

/** Weekday code for a `YYYY-MM-DD` calendar date, evaluated at Manila noon (offset-safe). */
export function weekdayOf(date: string): WeekdayCode {
  const d = new Date(`${date}T12:00:00${MANILA_OFFSET}`);
  return WEEKDAYS[d.getUTCDay()];
}

/** `2026-09-01` + `09:00` → `2026-09-01T09:00:00+08:00`. */
export function toIso(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00${MANILA_OFFSET}`;
}

/** `2026-09-01T09:00:00+08:00` → `09:00` (Manila local HH:mm). */
export function hhmmOf(iso: string): string {
  const d = new Date(iso);
  const manila = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${String(manila.getUTCHours()).padStart(2, "0")}:${String(manila.getUTCMinutes()).padStart(2, "0")}`;
}

/** `2026-09-01T09:00:00+08:00` → `2026-09-01` (Manila local date). */
export function dateOf(iso: string): string {
  const d = new Date(iso);
  const manila = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

/** Inclusive list of `YYYY-MM-DD` dates from `from` to `to`. */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00${MANILA_OFFSET}`);
  const end = new Date(`${to}T00:00:00${MANILA_OFFSET}`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    // t is Manila midnight (16:00 UTC the prior day); shift +8h to land on UTC midnight of the
    // correct Manila calendar date before slicing.
    out.push(new Date(t + 8 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return out;
}

/** Add `minutes` to a `HH:mm` string (same-day; scheduling windows never cross midnight). */
export function addMinutesHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
