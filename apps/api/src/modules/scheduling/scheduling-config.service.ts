import { Injectable } from "@nestjs/common";
import type { BayInput, BlockInput, OperatingHoursInput, ServiceTypeInput, ShiftInput, ShiftQuery, ShiftUpdate } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { toIso } from "./time";

// MECHANIC is here for the board only — the field app's task list is its single
// scheduling call. It also grants capacity writes, which is wrong; splitting the
// gate is tracked separately.
const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "ADMIN"]);

export type BoardAppointment = {
  id: string;
  bayId: string | null;
  vehicleId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  requiresPickup: boolean;
  vehiclePlateNo: string;
  memberName: string | null;
};

/**
 * Advisor/admin-managed capacity configuration (bays, shifts, service types, operating hours,
 * blocks) plus the advisor board's day/range appointment feed. All writes are staff-gated here;
 * the AuthGuard has already authenticated the caller (Firebase or sealed staff session).
 */
@Injectable()
export class SchedulingConfigService {
  constructor(private prisma: PrismaService) {}

  private assertStaff(u: AbilityUser): void {
    if (!STAFF_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }

  // ---- Service types (members read to pick a service; staff manage) ----
  listServiceTypes() {
    return this.prisma.serviceType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  async createServiceType(u: AbilityUser, dto: ServiceTypeInput) {
    this.assertStaff(u);
    return this.prisma.serviceType.create({
      data: {
        code: dto.code, name: dto.name, standardDurationMin: dto.standardDurationMin,
        requiredSkills: dto.requiredSkills, priceCentavos: BigInt(dto.priceCentavos),
        entitlementType: dto.entitlementType ?? null, intervalDays: dto.intervalDays ?? null, intervalKm: dto.intervalKm ?? null,
      },
    });
  }

  // ---- Bays ----
  listBays(u: AbilityUser) {
    this.assertStaff(u);
    return this.prisma.serviceBay.findMany({ orderBy: { name: "asc" } });
  }
  async createBay(u: AbilityUser, dto: BayInput) {
    this.assertStaff(u);
    return this.prisma.serviceBay.create({ data: { name: dto.name, capabilities: dto.capabilities, isActive: dto.isActive } });
  }

  // ---- Shifts ----
  async createShift(u: AbilityUser, dto: ShiftInput) {
    this.assertStaff(u);
    this.assertTimeOrder(dto.startTime, dto.endTime);
    return this.prisma.staffShift.create({
      data: { userId: dto.userId, date: dto.date, startTime: dto.startTime, endTime: dto.endTime, skills: dto.skills },
    });
  }

  /**
   * People who can be put on a shift. Deliberately separate from the admin
   * staff directory: rostering is an advisor's job, so this is staff-gated and
   * returns only what a roster form needs — no contact details, no members, and
   * no way to change anything. Enumerating accounts stays admin-only.
   */
  async listRosterableStaff(u: AbilityUser) {
    this.assertStaff(u);
    return this.prisma.user.findMany({
      where: { role: { in: ["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }

  /** The roster for a date range, with the person attached so the console can
   *  show who is on without a second lookup. */
  async listShifts(u: AbilityUser, q: ShiftQuery) {
    this.assertStaff(u);
    const rows = await this.prisma.staffShift.findMany({
      where: { date: { gte: q.from, lte: q.to } },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id, date: r.date, startTime: r.startTime, endTime: r.endTime, skills: r.skills,
      userId: r.userId, userName: r.user.name, userEmail: r.user.email, userRole: r.user.role,
    }));
  }

  async updateShift(u: AbilityUser, id: string, dto: ShiftUpdate) {
    this.assertStaff(u);
    const existing = await this.prisma.staffShift.findUnique({ where: { id } });
    if (!existing) throw new DomainError("SLOT_UNAVAILABLE", "no such shift", 404);
    // Validate against the merged result: a patch that only moves one end can
    // still invert the pair.
    this.assertTimeOrder(dto.startTime ?? existing.startTime, dto.endTime ?? existing.endTime);
    return this.prisma.staffShift.update({ where: { id }, data: dto });
  }

  async deleteShift(u: AbilityUser, id: string) {
    this.assertStaff(u);
    const existing = await this.prisma.staffShift.findUnique({ where: { id } });
    if (!existing) throw new DomainError("SLOT_UNAVAILABLE", "no such shift", 404);
    await this.prisma.staffShift.delete({ where: { id } });
    return { deleted: true };
  }

  /** A shift whose end is not after its start silently contributes zero
   *  capacity — the capacity engine just never matches it — so reject it here
   *  rather than let it look scheduled. */
  private assertTimeOrder(start: string, end: string): void {
    if (start >= end) throw new DomainError("SLOT_UNAVAILABLE", "shift must end after it starts", 422);
  }

  // ---- Blocks (maintenance/holiday) ----
  async createBlock(u: AbilityUser, dto: BlockInput) {
    this.assertStaff(u);
    return this.prisma.capacityBlock.create({
      data: { bayId: dto.bayId ?? null, date: dto.date, startTime: dto.startTime, endTime: dto.endTime, reason: dto.reason, createdBy: u.id },
    });
  }

  // ---- Operating hours (upsert by weekday or by dateOverride) ----
  /** Read side of the operating-hours config — the Board's walk-in buffer row. */
  async listOperatingHours(u: AbilityUser) {
    this.assertStaff(u);
    return this.prisma.operatingHours.findMany({ orderBy: { weekday: "asc" } });
  }

  async upsertOperatingHours(u: AbilityUser, dto: OperatingHoursInput) {
    this.assertStaff(u);
    if (!dto.weekday && !dto.dateOverride) throw new DomainError("FORBIDDEN_ROLE", "weekday or dateOverride required", 400);
    const data = { openTime: dto.openTime ?? null, closeTime: dto.closeTime ?? null, walkInBufferPct: dto.walkInBufferPct };
    if (dto.dateOverride) {
      return this.prisma.operatingHours.upsert({
        where: { dateOverride: dto.dateOverride },
        create: { dateOverride: dto.dateOverride, ...data },
        update: data,
      });
    }
    return this.prisma.operatingHours.upsert({
      where: { weekday: dto.weekday! },
      create: { weekday: dto.weekday!, ...data },
      update: data,
    });
  }

  // ---- Board feed: appointments in a date range, decorated for rendering ----
  async board(u: AbilityUser, from: string, to: string): Promise<BoardAppointment[]> {
    this.assertStaff(u);
    const rows = await this.prisma.appointment.findMany({
      where: {
        scheduledStart: { gte: new Date(toIso(from, "00:00")), lte: new Date(toIso(to, "23:59")) },
      },
      include: { serviceType: { select: { name: true } }, vehicle: { select: { plateNo: true, owner: { select: { name: true } } } } },
      orderBy: { scheduledStart: "asc" },
    });
    return rows.map((r) => ({
      // vehicleId lets the field app open an inspection straight from a task
      // instead of dropping the technician into a plate search.
      id: r.id, bayId: r.bayId, vehicleId: r.vehicleId, serviceTypeId: r.serviceTypeId, serviceTypeName: r.serviceType.name,
      scheduledStart: r.scheduledStart.toISOString(), scheduledEnd: r.scheduledEnd.toISOString(),
      status: r.status, requiresPickup: r.requiresPickup,
      vehiclePlateNo: r.vehicle.plateNo, memberName: r.vehicle.owner?.name ?? null,
    }));
  }
}
