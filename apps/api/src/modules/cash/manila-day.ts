import { BadRequestException } from "@nestjs/common";

/**
 * Resolves the `[start, end)` UTC instant range for a Manila calendar day given as
 * `YYYY-MM-DD` (Ruling: cash reconciliation is done on Philippine business days).
 * The Philippines does not observe DST, so a fixed `+08:00` offset is safe.
 */
export function manilaDayRange(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException("Invalid date — expected YYYY-MM-DD");
  }
  const start = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) {
    throw new BadRequestException("Invalid date — expected YYYY-MM-DD");
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
