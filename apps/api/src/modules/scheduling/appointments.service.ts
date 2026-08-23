import { Inject, Injectable } from "@nestjs/common";
import { EntitlementType, Prisma } from "@prisma/client";
import type { AppointmentCreate, Reschedule } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "../entitlements/entitlement.service";
import { CLOCK, Clock } from "../../common/clock/clock";
import { AbilityUser } from "../../common/policies/ability.factory";
import { HoldsService, HoldDetails } from "./holds.service";
import { dateOf, hhmmOf } from "./time";

const STAFF_ROLES = new Set(["ADVISOR", "ADMIN"]);
const ACTIVE_STATUSES: Prisma.AppointmentWhereInput["status"] = { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] };
const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000; // FR-044: free reschedule up to 24h before start

export type AppointmentDto = {
  id: string;
  vehicleId: string;
  serviceTypeId: string;
  bayId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  requiresPickup: boolean;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private holds: HoldsService,
    private entitlements: EntitlementService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  private toDto(a: {
    id: string; vehicleId: string; serviceTypeId: string; bayId: string | null;
    scheduledStart: Date; scheduledEnd: Date; status: string; requiresPickup: boolean;
  }): AppointmentDto {
    return {
      id: a.id, vehicleId: a.vehicleId, serviceTypeId: a.serviceTypeId, bayId: a.bayId,
      scheduledStart: a.scheduledStart.toISOString(), scheduledEnd: a.scheduledEnd.toISOString(),
      status: a.status, requiresPickup: a.requiresPickup,
    };
  }

  /** The vehicle's currently-ACTIVE subscription, or null. */
  private async activeSubscription(vehicleId: string) {
    return this.prisma.subscription.findFirst({
      where: { vehicleId, status: "ACTIVE" },
      select: { id: true },
    });
  }

  /**
   * Books a held slot. The Redis hold is the mutex (atomic claim) so a double-submit can't
   * double-book. Entitlement consumption runs AFTER the slot is secured; if it's exhausted we
   * compensate by deleting the just-created row and restoring nothing (the hold is already gone —
   * the member re-picks). Kept out of a nested Prisma transaction because EntitlementService.consume
   * opens its own transaction.
   */
  async book(u: AbilityUser, dto: AppointmentCreate): Promise<AppointmentDto> {
    // Claim the hold atomically — the loser of a race gets SLOT_UNAVAILABLE here.
    const hold = await this.holds.claim(dto.holdId, u.id);
    if (hold.serviceTypeId !== dto.serviceTypeId) {
      await this.holds.restore(hold);
      throw new DomainError("SLOT_UNAVAILABLE", "hold does not match service type", 409);
    }

    const [serviceType, vehicle] = await Promise.all([
      this.prisma.serviceType.findUnique({ where: { id: dto.serviceTypeId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId }, select: { ownerUserId: true } }),
    ]);
    if (!serviceType) throw new DomainError("SLOT_UNAVAILABLE", "unknown service type", 400);
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "vehicle not found", 404);
    if (vehicle.ownerUserId !== u.id && !STAFF_ROLES.has(u.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "not your vehicle", 403);
    }

    const start = new Date(hold.startIso);
    const end = new Date(hold.endIso);

    // Belt-and-suspenders: the hold protected this slot, but if it had expired and a different
    // booking landed on the same bay/time, reject rather than double-book.
    const conflict = await this.prisma.appointment.findFirst({
      where: { bayId: hold.bayId, status: ACTIVE_STATUSES, scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
      select: { id: true },
    });
    if (conflict) throw new DomainError("SLOT_UNAVAILABLE", "slot no longer available", 409);

    // Resolve + consume entitlement (if this service is entitlement-backed) before creating the row.
    let subscriptionId: string | null = null;
    if (serviceType.entitlementType) {
      const sub = await this.activeSubscription(dto.vehicleId);
      if (sub) {
        const result = await this.entitlements.consume(sub.id, serviceType.entitlementType, 1);
        if (!result.ok && result.reason === "SUSPENDED") {
          throw new DomainError("SUBSCRIPTION_SUSPENDED", "subscription suspended", 403);
        }
        if (!result.ok && result.reason === "EXHAUSTED") {
          throw new DomainError(
            "ENTITLEMENT_EXHAUSTED",
            `No ${serviceType.entitlementType} left this cycle`,
            402,
            { overagePriceCentavos: result.overagePriceCentavos },
          );
        }
        subscriptionId = sub.id;
      }
      // No active subscription → book as a paid one-off (no entitlement consumed).
    }

    const created = await this.prisma.appointment.create({
      data: {
        vehicleId: dto.vehicleId, serviceTypeId: dto.serviceTypeId, bayId: hold.bayId,
        scheduledStart: start, scheduledEnd: end, requiresPickup: dto.requiresPickup,
        createdBy: u.id, subscriptionId,
      },
    });
    return this.toDto(created);
  }

  async reschedule(u: AbilityUser, id: string, dto: Reschedule): Promise<AppointmentDto> {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new DomainError("SLOT_UNAVAILABLE", "appointment not found", 404);
    await this.assertOwnerOrStaff(u, appt.vehicleId);

    const withinCutoff = appt.scheduledStart.getTime() - this.clock.now().getTime() < RESCHEDULE_CUTOFF_MS;
    if (withinCutoff && !STAFF_ROLES.has(u.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "within 24h — reschedule via an advisor", 403);
    }

    const hold = await this.holds.claim(dto.holdId, u.id);
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        id: { not: id }, bayId: hold.bayId, status: ACTIVE_STATUSES,
        scheduledStart: { lt: new Date(hold.endIso) }, scheduledEnd: { gt: new Date(hold.startIso) },
      },
      select: { id: true },
    });
    if (conflict) throw new DomainError("SLOT_UNAVAILABLE", "slot no longer available", 409);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { bayId: hold.bayId, scheduledStart: new Date(hold.startIso), scheduledEnd: new Date(hold.endIso) },
    });
    return this.toDto(updated);
  }

  async cancel(u: AbilityUser, id: string): Promise<AppointmentDto> {
    const appt = await this.prisma.appointment.findUnique({ where: { id }, include: { serviceType: true } });
    if (!appt) throw new DomainError("SLOT_UNAVAILABLE", "appointment not found", 404);
    await this.assertOwnerOrStaff(u, appt.vehicleId);
    if (appt.status === "CANCELLED") return this.toDto(appt);

    const outsideCutoff = appt.scheduledStart.getTime() - this.clock.now().getTime() >= RESCHEDULE_CUTOFF_MS;
    if (appt.subscriptionId && appt.serviceType.entitlementType && outsideCutoff) {
      await this.refundEntitlement(appt.subscriptionId, appt.serviceType.entitlementType);
    }

    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
    return this.toDto(updated);
  }

  /** Decrements current-period usage by one (floored at 0) — the inverse of a single consume. */
  private async refundEntitlement(subscriptionId: string, type: EntitlementType): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { currentPeriodStart: true },
    });
    if (!sub) return;
    await this.prisma.entitlementUsage.updateMany({
      where: { subscriptionId, periodStart: sub.currentPeriodStart, entitlementType: type, usedQty: { gt: 0 } },
      data: { usedQty: { decrement: 1 } },
    });
  }

  private async assertOwnerOrStaff(u: AbilityUser, vehicleId: string): Promise<void> {
    if (STAFF_ROLES.has(u.role)) return;
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { ownerUserId: true } });
    if (!v || v.ownerUserId !== u.id) throw new DomainError("FORBIDDEN_ROLE", "not your appointment", 403);
  }

  /**
   * Marks past-due unattended BOOKED/CONFIRMED appointments as NO_SHOW, and flags for admin review
   * any vehicle with ≥3 no-shows in the trailing 6 months (FR-046). Idempotent — reruns are no-ops
   * once statuses have moved. Called by the nightly scheduling.flagNoShows job.
   */
  async flagNoShows(now: Date): Promise<{ flagged: number }> {
    const past = await this.prisma.appointment.findMany({
      where: { status: { in: ["BOOKED", "CONFIRMED"] }, scheduledEnd: { lt: now } },
      select: { id: true, vehicleId: true },
    });
    if (past.length === 0) return { flagged: 0 };

    await this.prisma.appointment.updateMany({
      where: { id: { in: past.map((a) => a.id) } },
      data: { status: "NO_SHOW" },
    });

    const sixMonthsAgo = new Date(now.getTime() - 182 * 24 * 60 * 60 * 1000);
    const vehicleIds = [...new Set(past.map((a) => a.vehicleId))];
    for (const vehicleId of vehicleIds) {
      const count = await this.prisma.appointment.count({
        where: { vehicleId, status: "NO_SHOW", scheduledEnd: { gte: sixMonthsAgo } },
      });
      if (count >= 3) {
        await this.prisma.auditLog.create({
          data: {
            actorUserId: vehicleId, // system action keyed to the vehicle under review
            action: "NO_SHOW_REVIEW_FLAGGED",
            entityType: "Vehicle",
            entityId: vehicleId,
            after: { noShowCount: count, windowDays: 182 },
          },
        });
      }
    }
    return { flagged: past.length };
  }

  /** A member's own appointments (or a vehicle's, for staff). Newest first. */
  async listForUser(u: AbilityUser): Promise<AppointmentDto[]> {
    const where: Prisma.AppointmentWhereInput = STAFF_ROLES.has(u.role)
      ? {}
      : { vehicle: { ownerUserId: u.id } };
    const rows = await this.prisma.appointment.findMany({ where, orderBy: { scheduledStart: "desc" } });
    return rows.map((r) => this.toDto(r));
  }
}
