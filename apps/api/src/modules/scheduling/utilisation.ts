/**
 * Pure utilisation math (FR-052). "available" is the day's concurrent resource-hours — operating
 * hours × the number of simultaneously-serviceable slots, which is bounded by the smaller of active
 * bays and mechanics on shift (a slot needs both). "booked" is that day's active appointment count.
 * ratio = booked / available (0 when the shop is closed or unstaffed).
 */
export type DayUtilisation = { date: string; booked: number; available: number; ratio: number };

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function computeDayUtilisation(input: {
  date: string;
  operatingWindow: { open: string; close: string } | null;
  activeBays: number;
  mechanicsOnShift: number;
  bookedCount: number;
}): DayUtilisation {
  const { date, operatingWindow, activeBays, mechanicsOnShift, bookedCount } = input;
  if (!operatingWindow || activeBays === 0 || mechanicsOnShift === 0) {
    return { date, booked: bookedCount, available: 0, ratio: 0 };
  }
  const windowHours = (toMin(operatingWindow.close) - toMin(operatingWindow.open)) / 60;
  const available = Math.max(0, Math.floor(windowHours * Math.min(activeBays, mechanicsOnShift)));
  const ratio = available > 0 ? bookedCount / available : 0;
  return { date, booked: bookedCount, available, ratio };
}
