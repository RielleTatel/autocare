/**
 * Pure billing math — no I/O, no Prisma, no Nest DI. All dates are computed in
 * Asia/Manila (fixed UTC+08:00, no DST — Ruling MANILA), independent of the
 * host process's local timezone.
 *
 * Representation trick: `toManila(date)` returns a *new* `Date` instance whose
 * UTC getters (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`, `getUTCHours`, ...)
 * read as Manila wall-clock time. This "fake UTC as local" Date is only ever
 * used for reading/constructing calendar fields — comparing it against a real
 * instant with `.getTime()` would be wrong by 8 hours, so it is never mixed
 * with real instants. `addMonthsManila` takes and returns *real* instants
 * (correct `.getTime()`), converting to/from Manila parts internally.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Months-per-cycle for each billing interval — drives `currentPeriodEnd` / next-cycle math.
 * Shared by SubscriptionsService (Task 4) and BillingService (Task 8's `billing.issueInvoices`)
 * so both compute the same cycle length for a given plan.
 */
export const INTERVAL_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

/** Real-instant day index of the Manila calendar day containing `date` — floor(shifted ms / day ms). Two dates
 * with the same index fall on the same Manila calendar day; the difference between two indices is the number
 * of Manila calendar days between them. Used by Task 8's billing jobs for "is X due/crossing a boundary today"
 * and "days since Y" checks against the injected clock. */
export function manilaDayIndex(date: Date): number {
  return Math.floor(toManila(date).getTime() / 86_400_000);
}

/** Shifts a real instant into a Date whose UTC getters read as Manila wall-clock time. */
export function toManila(date: Date): Date {
  return new Date(date.getTime() + MANILA_OFFSET_MS);
}

/** `toManila(new Date())` — current time as Manila wall-clock fields. */
export function manilaNow(): Date {
  return toManila(new Date());
}

interface ManilaParts {
  year: number;
  month: number; // 0-indexed
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
}

function toManilaParts(date: Date): ManilaParts {
  const shifted = toManila(date);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

/** Inverse of toManilaParts: rebuilds the real instant (correct .getTime()) from Manila wall-clock fields. */
function fromManilaParts(p: ManilaParts): Date {
  const asIfUtc = Date.UTC(p.year, p.month, p.day, p.hours, p.minutes, p.seconds, p.ms);
  return new Date(asIfUtc - MANILA_OFFSET_MS);
}

function daysInMonth(year: number, month0: number): number {
  // Day 0 of the *next* month is the last day of the target month.
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Adds `n` calendar months to `date`, in Manila wall-clock time, preserving
 * time-of-day. When the source day-of-month doesn't exist in the target month
 * (e.g. Jan 31 + 1 month), the day is clamped to the target month's last valid
 * day (Jan 31 -> Feb 28, or Feb 29 in a leap year).
 */
export function addMonthsManila(date: Date, n: number): Date {
  const p = toManilaParts(date);
  const totalMonths = p.month + n;
  const year = p.year + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(p.day, daysInMonth(year, month));
  return fromManilaParts({ ...p, year, month, day });
}

/** Round half up (nearest integer, .5 rounds toward +Infinity) — the rounding rule for all money math here. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/**
 * Pro-rated upgrade charge: the price delta between plans, scaled by the
 * fraction of the current billing period remaining. Rounded to the nearest
 * centavo (round half up).
 */
export function proratedUpgradeCentavos(
  oldPriceCentavos: number,
  newPriceCentavos: number,
  remainingDays: number,
  periodDays: number,
): number {
  const delta = newPriceCentavos - oldPriceCentavos;
  return roundHalfUp((delta * remainingDays) / periodDays);
}

/**
 * Early-termination fee (BR-08, D-3 default): remaining lock-in months times
 * 50% of the monthly fee, rounded to the nearest centavo (round half up).
 */
export function etfCentavos(monthlyFeeCentavos: number, remainingLockInMonthsCount: number): number {
  return roundHalfUp(remainingLockInMonthsCount * monthlyFeeCentavos * 0.5);
}

/**
 * Whole months remaining until `lockInEndsAt`, computed in Manila. Any partial
 * month counts as a full month (ceiling) — a subscriber cancelling one day
 * into a lock-in month still owes that month's ETF share. Returns 0 once
 * `now` has reached or passed `lockInEndsAt`.
 */
export function remainingLockInMonths(lockInEndsAt: Date, now: Date): number {
  if (now.getTime() >= lockInEndsAt.getTime()) return 0;

  const nowP = toManilaParts(now);
  const endP = toManilaParts(lockInEndsAt);

  let months = (endP.year - nowP.year) * 12 + (endP.month - nowP.month);

  const nowTimeOfDay = nowP.day * 86_400_000 + nowP.hours * 3_600_000 + nowP.minutes * 60_000 + nowP.seconds * 1000 + nowP.ms;
  const endTimeOfDay = endP.day * 86_400_000 + endP.hours * 3_600_000 + endP.minutes * 60_000 + endP.seconds * 1000 + endP.ms;
  if (endTimeOfDay > nowTimeOfDay) months += 1;

  return Math.max(months, 0);
}
