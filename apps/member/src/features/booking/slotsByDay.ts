import type { Slot } from "./bookingApi";

const MANILA = "Asia/Manila";

/** The civil date in Manila, as YYYY-MM-DD. */
export function manilaDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: MANILA });
}

/** The hour in Manila, 0-23. */
function manilaHour(iso: string): number {
  return Number(
    new Date(iso).toLocaleString("en-PH", { timeZone: MANILA, hour: "2-digit", hour12: false }).slice(0, 2),
  );
}

export type PartOfDay = "MORNING" | "AFTERNOON" | "EVENING";

export function partOfDay(iso: string): PartOfDay {
  const h = manilaHour(iso);
  if (h < 12) return "MORNING";
  if (h < 17) return "AFTERNOON";
  return "EVENING";
}

export type SlotDay = { date: string; slots: Slot[] };

/**
 * Split a flat multi-day slot list into one entry per day, chronologically.
 *
 * The API returns a rolling two-week window in one array. Rendered flat, the
 * same clock times repeat with nothing to distinguish them — which reads as
 * duplicated data rather than as a fortnight of availability.
 *
 * Days are keyed on the Manila civil date, not the device's: a 23:00 slot is
 * still that evening locally, but the next day in UTC.
 */
export function groupByManilaDay(slots: Slot[]): SlotDay[] {
  const byDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const day = manilaDayOf(s.start);
    const list = byDate.get(day) ?? [];
    list.push(s);
    byDate.set(day, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      slots: [...list].sort((x, y) => x.start.localeCompare(y.start)),
    }));
}
