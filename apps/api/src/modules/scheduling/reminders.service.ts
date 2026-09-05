import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnnouncementsService } from "../announcements/announcements.service";

const DAY_MS = 86_400_000;
const STAGGER_WINDOW_DAYS = 28; // every vehicle is reminded within any 28-day window (load shaping)

export type DueReason = "TIME" | "ODOMETER";
export type DueCandidate = {
  vehicleId: string;
  serviceTypeId: string;
  reason: DueReason;
  /** null for org-owned (fleet) vehicles — no single member to notify. */
  userId: string | null;
  serviceTypeName: string;
};

/** FNV-1a over a string — a small stable hash so a vehicle's stagger bucket never drifts. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The 0..27 day-bucket a vehicle's reminders are sent on. */
export function staggerBucket(vehicleId: string): number {
  return fnv1a(vehicleId) % STAGGER_WINDOW_DAYS;
}

/** Which day-bucket a given instant falls in (epoch-day mod 28 — cycles cleanly across months). */
export function bucketForDay(now: Date): number {
  return Math.floor(now.getTime() / DAY_MS) % STAGGER_WINDOW_DAYS;
}

/**
 * Pure due-check: due by TIME if the service interval (days) has elapsed since the baseline date;
 * due by ODOMETER if the km delta since the baseline reading meets the interval. TIME wins when
 * both apply. Manufacturer-default intervals come from the ServiceType.
 */
export function dueReason(p: {
  now: Date;
  baselineDate: Date;
  intervalDays: number | null;
  currentOdometerKm: number;
  baselineOdometerKm: number;
  intervalKm: number | null;
}): DueReason | null {
  const dueByTime = p.intervalDays != null && p.now.getTime() - p.baselineDate.getTime() >= p.intervalDays * DAY_MS;
  const dueByOdo = p.intervalKm != null && p.currentOdometerKm - p.baselineOdometerKm >= p.intervalKm;
  if (dueByTime) return "TIME";
  if (dueByOdo) return "ODOMETER";
  return null;
}

/**
 * Baseline for a service interval, most-trustworthy first: a real completed appointment of
 * that type, else the member-entered last-service date, else vehicle registration.
 */
export function resolveBaselineDate(
  lastCompleted: Date | undefined,
  lastServiceAt: Date | null,
  createdAt: Date,
): Date {
  return lastCompleted ?? lastServiceAt ?? createdAt;
}

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService, private announcements: AnnouncementsService) {}

  /**
   * Vehicles due for a service, one candidate per (vehicle, serviceType). Baselines: last COMPLETED
   * appointment of that type (else vehicle registration date), and the vehicle's earliest recorded
   * odometer (else 0). Loads inputs in bulk and computes in memory — this is a daily batch job, not
   * a request path.
   */
  async dueCandidates(now: Date): Promise<DueCandidate[]> {
    const [vehicles, serviceTypes] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, currentOdometerKm: true, createdAt: true, lastServiceAt: true, ownerUserId: true },
      }),
      this.prisma.serviceType.findMany({
        where: { isActive: true, OR: [{ intervalDays: { not: null } }, { intervalKm: { not: null } }] },
        select: { id: true, name: true, intervalDays: true, intervalKm: true },
      }),
    ]);
    if (vehicles.length === 0 || serviceTypes.length === 0) return [];

    const vehicleIds = vehicles.map((v) => v.id);
    const [completed, firstReadings] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { vehicleId: { in: vehicleIds }, status: "COMPLETED" },
        select: { vehicleId: true, serviceTypeId: true, scheduledStart: true },
        orderBy: { scheduledStart: "desc" },
      }),
      this.prisma.odometerReading.findMany({
        where: { vehicleId: { in: vehicleIds } },
        select: { vehicleId: true, km: true },
        orderBy: { recordedAt: "asc" },
      }),
    ]);

    const lastServiceAt = new Map<string, Date>(); // key `${vehicleId}:${serviceTypeId}`
    for (const c of completed) {
      const key = `${c.vehicleId}:${c.serviceTypeId}`;
      if (!lastServiceAt.has(key)) lastServiceAt.set(key, c.scheduledStart); // desc order → first seen is latest
    }
    const baselineOdo = new Map<string, number>(); // earliest reading per vehicle
    for (const r of firstReadings) if (!baselineOdo.has(r.vehicleId)) baselineOdo.set(r.vehicleId, r.km);

    const out: DueCandidate[] = [];
    for (const v of vehicles) {
      for (const st of serviceTypes) {
        const reason = dueReason({
          now,
          baselineDate: resolveBaselineDate(lastServiceAt.get(`${v.id}:${st.id}`), v.lastServiceAt, v.createdAt),
          intervalDays: st.intervalDays,
          currentOdometerKm: v.currentOdometerKm,
          baselineOdometerKm: baselineOdo.get(v.id) ?? 0,
          intervalKm: st.intervalKm,
        });
        if (reason)
          out.push({
            vehicleId: v.id,
            serviceTypeId: st.id,
            reason,
            userId: v.ownerUserId,
            serviceTypeName: st.name,
          });
      }
    }
    return out;
  }

  /** Extracted so tests can pin the stagger without having to reverse the hash. */
  private isInTodaysBucket(vehicleId: string, now: Date): boolean {
    return staggerBucket(vehicleId) === bucketForDay(now);
  }

  /**
   * Opens a SERVICE_DUE announcement thread for every due vehicle whose stagger bucket matches
   * today's — spreading sends across a 28-day window (Architecture §7.7 load shaping).
   * Idempotency is the thread state machine's job: re-running creates nothing new, because
   * SERVICE_DUE_DETECTED on an already-open thread is a no-op.
   */
  async serviceDue(now: Date): Promise<{ created: number }> {
    const candidates = (await this.dueCandidates(now)).filter((c) => this.isInTodaysBucket(c.vehicleId, now));

    let created = 0;
    for (const c of candidates) {
      if (!c.userId) continue; // org-owned vehicle — no single member to notify
      await this.announcements.applyThreadEvent({
        userId: c.userId,
        vehicleId: c.vehicleId,
        serviceTypeId: c.serviceTypeId,
        serviceTypeName: c.serviceTypeName,
        event: { type: "SERVICE_DUE_DETECTED" },
        reason: c.reason,
      });
      created++;
    }
    return { created };
  }
}
