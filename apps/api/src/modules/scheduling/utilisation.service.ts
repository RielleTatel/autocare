import { Inject, Injectable } from "@nestjs/common";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK, Clock } from "../../common/clock/clock";
import { AbilityUser } from "../../common/policies/ability.factory";
import { computeDayUtilisation, DayUtilisation } from "./utilisation";
import { datesInRange, dateOf, toIso, weekdayOf } from "./time";

const ACTIVE_STATUSES = ["BOOKED", "CONFIRMED", "IN_PROGRESS"] as const;
export const UTILISATION_ALARM_THRESHOLD = 0.85; // FR-052 default; forward booking above this alarms

/**
 * Forward-looking capacity utilisation (FR-052). Loads the window's config + bookings in a fixed
 * number of queries (like SchedulingService) and runs the pure day calculator per date. The daily
 * alarm writes an admin AuditLog when any forward day breaches the threshold.
 */
@Injectable()
export class UtilisationService {
  constructor(
    private prisma: PrismaService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  async forWindow(fromDate: string, days: number): Promise<DayUtilisation[]> {
    const dates = datesInRange(fromDate, addDays(fromDate, days - 1));
    const windowStartIso = toIso(dates[0], "00:00");
    const windowEndIso = toIso(dates[dates.length - 1], "23:59");

    const [bays, shifts, operatingRows, appointments] = await Promise.all([
      this.prisma.serviceBay.count({ where: { isActive: true } }),
      this.prisma.staffShift.findMany({ where: { date: { in: dates } }, select: { date: true, userId: true } }),
      this.prisma.operatingHours.findMany(),
      this.prisma.appointment.findMany({
        where: { status: { in: ACTIVE_STATUSES as unknown as any[] }, scheduledStart: { gte: new Date(windowStartIso), lte: new Date(windowEndIso) } },
        select: { scheduledStart: true },
      }),
    ]);

    const overrideByDate = new Map(operatingRows.filter((r) => r.dateOverride).map((r) => [r.dateOverride as string, r]));
    const byWeekday = new Map(operatingRows.filter((r) => r.weekday).map((r) => [r.weekday as string, r]));
    const mechByDate = new Map<string, Set<string>>();
    for (const s of shifts) (mechByDate.get(s.date) ?? mechByDate.set(s.date, new Set()).get(s.date)!).add(s.userId);
    const bookedByDate = new Map<string, number>();
    for (const a of appointments) {
      const d = dateOf(a.scheduledStart.toISOString());
      bookedByDate.set(d, (bookedByDate.get(d) ?? 0) + 1);
    }

    return dates.map((date) => {
      const oh = overrideByDate.get(date) ?? byWeekday.get(weekdayOf(date));
      return computeDayUtilisation({
        date,
        operatingWindow: oh && oh.openTime && oh.closeTime ? { open: oh.openTime, close: oh.closeTime } : null,
        activeBays: bays,
        mechanicsOnShift: mechByDate.get(date)?.size ?? 0,
        bookedCount: bookedByDate.get(date) ?? 0,
      });
    });
  }

  async forWindowForUser(u: AbilityUser, days: number): Promise<DayUtilisation[]> {
    if (u.role !== "ADMIN" && u.role !== "ADVISOR") throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
    const from = dateOf(this.clock.now().toISOString());
    return this.forWindow(from, days);
  }

  /** Daily job: alarm (admin AuditLog) when any forward day in the next 14 breaches the threshold. */
  async utilisationAlarm(now: Date): Promise<{ breached: number }> {
    const from = dateOf(now.toISOString());
    const rows = await this.forWindow(from, 14);
    const breaching = rows.filter((r) => r.ratio > UTILISATION_ALARM_THRESHOLD);
    if (breaching.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: "00000000-0000-0000-0000-000000000000", // system
          action: "UTILISATION_ALARM",
          entityType: "Capacity",
          entityId: from,
          after: { threshold: UTILISATION_ALARM_THRESHOLD, days: breaching.map((b) => ({ date: b.date, ratio: Number(b.ratio.toFixed(2)) })) },
        },
      });
    }
    return { breached: breaching.length };
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
