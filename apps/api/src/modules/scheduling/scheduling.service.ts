import { Injectable } from "@nestjs/common";
import type { SlotQuery } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { HoldsService } from "./holds.service";
import { availableSlots, CapacityInputs } from "./capacity-engine";
import { datesInRange, dateOf, hhmmOf, toIso, weekdayOf } from "./time";

export type SlotDto = { start: string; end: string; bayId: string; serviceTypeId: string };

const ACTIVE_APPT_STATUSES = ["BOOKED", "CONFIRMED", "IN_PROGRESS"] as const;

/**
 * Loads scheduling inputs for the whole [from,to] window in a FIXED number of queries (not per
 * day) and runs the pure capacity engine once per date. Batching matters because the DB is remote
 * (Supabase): a per-day loader would issue O(days) round-trips and blow the 800 ms NFR-005 budget.
 */
@Injectable()
export class SchedulingService {
  constructor(
    private prisma: PrismaService,
    private holds: HoldsService,
  ) {}

  async slots(q: SlotQuery): Promise<SlotDto[]> {
    const serviceType = await this.prisma.serviceType.findUnique({ where: { id: q.serviceTypeId } });
    if (!serviceType || !serviceType.isActive) throw new DomainError("SLOT_UNAVAILABLE", "unknown service type", 404);

    const dates = datesInRange(q.from, q.to);
    const windowStartIso = toIso(q.from, "00:00");
    const windowEndIso = toIso(dates[dates.length - 1], "23:59");

    // ---- Batched loads (6 round-trips total, independent of window size) ----
    const [bays, shifts, operatingRows, blocks, appointments, activeHolds] = await Promise.all([
      this.prisma.serviceBay.findMany({ where: { isActive: true } }),
      this.prisma.staffShift.findMany({ where: { date: { in: dates } } }),
      this.prisma.operatingHours.findMany(),
      this.prisma.capacityBlock.findMany({ where: { date: { in: dates } } }),
      this.prisma.appointment.findMany({
        where: {
          status: { in: ACTIVE_APPT_STATUSES as unknown as any[] },
          scheduledStart: { gte: new Date(windowStartIso), lte: new Date(windowEndIso) },
          bayId: { not: null },
        },
        select: { bayId: true, scheduledStart: true, scheduledEnd: true },
      }),
      this.holds.activeHoldsForDates(dates),
    ]);

    // Index inputs by date for O(1) per-day assembly.
    const overrideByDate = new Map(operatingRows.filter((r) => r.dateOverride).map((r) => [r.dateOverride as string, r]));
    const byWeekday = new Map(operatingRows.filter((r) => r.weekday).map((r) => [r.weekday as string, r]));
    const shiftsByDate = groupBy(shifts, (s) => s.date);
    const blocksByDate = groupBy(blocks, (b) => b.date);
    const apptsByDate = groupBy(
      appointments.map((a) => ({ bayId: a.bayId as string, date: dateOf(a.scheduledStart.toISOString()), start: hhmmOf(a.scheduledStart.toISOString()), end: hhmmOf(a.scheduledEnd.toISOString()) })),
      (a) => a.date,
    );
    const holdsByDate = groupBy(activeHolds, (h) => h.date);

    const out: SlotDto[] = [];
    for (const date of dates) {
      const oh = overrideByDate.get(date) ?? byWeekday.get(weekdayOf(date));
      const operatingWindow = oh && oh.openTime && oh.closeTime ? { open: oh.openTime, close: oh.closeTime } : null;

      const inputs: CapacityInputs = {
        date,
        serviceType: { durationMin: serviceType.standardDurationMin, requiredSkills: serviceType.requiredSkills },
        operatingWindow,
        bays: bays.map((b) => ({ id: b.id, capabilities: b.capabilities })),
        blocks: (blocksByDate.get(date) ?? []).map((b) => ({ bayId: b.bayId, start: b.startTime, end: b.endTime })),
        shifts: (shiftsByDate.get(date) ?? []).map((s) => ({ mechanicId: s.userId, start: s.startTime, end: s.endTime, skills: s.skills })),
        appointments: (apptsByDate.get(date) ?? []).map((a) => ({ bayId: a.bayId, start: a.start, end: a.end })),
        holds: (holdsByDate.get(date) ?? []).map((h) => ({ bayId: h.bayId, start: h.start, end: h.end })),
        walkInBufferPct: oh?.walkInBufferPct ?? 0,
      };

      for (const slot of availableSlots(inputs)) {
        out.push({ start: toIso(date, slot.start), end: toIso(date, slot.end), bayId: slot.bayId, serviceTypeId: serviceType.id });
      }
    }
    return out;
  }
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k) ?? [];
    list.push(it);
    m.set(k, list);
  }
  return m;
}
