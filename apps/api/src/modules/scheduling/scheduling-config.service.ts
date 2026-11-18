import { Injectable } from "@nestjs/common";
import type { BayInput, BlockInput, OperatingHoursInput, ServiceTypeInput, ServiceTypeUpdate, ShiftInput, ShiftQuery, ShiftUpdate, FieldBookingQuery, FieldBooking, FieldBookingPage } from "@autocare/contracts";
import { Prisma } from "@prisma/client";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { toIso, dateOf } from "./time";

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
    return this.prisma.serviceType.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      include: { inspectionTemplateVersion: { include: { template: true } } },
    });
  }

  async createServiceType(u: AbilityUser, dto: ServiceTypeInput) {
    this.assertServiceManager(u);
    await this.assertTemplateAssignment(dto.inspectionRequired, dto.inspectionTemplateVersionId ?? null);
    return this.prisma.serviceType.create({
      data: {
        code: dto.code, name: dto.name, standardDurationMin: dto.standardDurationMin,
        requiredSkills: dto.requiredSkills, priceCentavos: BigInt(dto.priceCentavos),
        entitlementType: dto.entitlementType ?? null, intervalDays: dto.intervalDays ?? null, intervalKm: dto.intervalKm ?? null,
        inspectionRequired: dto.inspectionRequired,
        inspectionTemplateVersionId: dto.inspectionTemplateVersionId ?? null,
      },
      include: { inspectionTemplateVersion: { include: { template: true } } },
    });
  }

  private assertServiceManager(u: AbilityUser) {
    if (u.role !== "ADMIN" && u.role !== "ADVISOR") throw new DomainError("FORBIDDEN_ROLE", "only advisors and administrators manage services", 403);
  }

  async updateServiceType(u: AbilityUser, id: string, dto: ServiceTypeUpdate) {
    this.assertServiceManager(u);
    const service = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!service) throw new DomainError("SLOT_UNAVAILABLE", "service not found", 404);
    const inspectionRequired = dto.inspectionRequired ?? service.inspectionRequired;
    const templateVersionId = dto.inspectionTemplateVersionId !== undefined
      ? dto.inspectionTemplateVersionId
      : (dto.inspectionRequired === false ? null : service.inspectionTemplateVersionId);
    await this.assertTemplateAssignment(inspectionRequired, templateVersionId ?? null);
    return this.prisma.serviceType.update({ where: { id }, data: {
      ...dto,
      inspectionTemplateVersionId: templateVersionId,
      ...(dto.priceCentavos !== undefined ? { priceCentavos: BigInt(dto.priceCentavos) } : {}),
    }, include: { inspectionTemplateVersion: { include: { template: true } } } });
  }

  private async assertTemplateAssignment(inspectionRequired: boolean, templateVersionId: string | null): Promise<void> {
    if (!inspectionRequired && templateVersionId) {
      throw new DomainError("CHECKLIST_INVALID", "a service that does not require inspection cannot have an inspection template", 422);
    }
    if (!templateVersionId) return; // readiness is shown in admin; new bookings are guarded separately.
    const version = await this.prisma.checklistVersion.findUnique({
      where: { id: templateVersionId },
      include: { template: true },
    });
    if (!version || version.status !== "PUBLISHED" || !version.template?.isActive) {
      throw new DomainError("CHECKLIST_INVALID", "select a published version of an active inspection template", 422);
    }
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
        scheduledStart: { gte: new Date(toIso(from, "00:00")), lt: new Date(new Date(toIso(to, "00:00")).getTime() + 86_400_000) },
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

  private async canInspect(u: AbilityUser) {
    if (!STAFF_ROLES.has(u.role)) return false;
    const user = await this.prisma.user.findUnique({ where: { id: u.id }, select: { isCertifiedTechnician: true } });
    return user?.isCertifiedTechnician === true;
  }

  private async decorateBookings(rows: Prisma.AppointmentGetPayload<{ include: { serviceType: true; vehicle: { include: { owner: true } }; repairReturnForWorkOrder: { select: { id: true; inspectionId: true } } } }>[], certified: boolean, canCompleteService: boolean): Promise<FieldBooking[]> {
    const [reports, bays, templateVersions] = await Promise.all([
      this.prisma.inspection.findMany({
        where: { appointmentId: { in: rows.map(r => r.id) }, submittedAt: { not: null } },
        select: { id: true, appointmentId: true, scope: true, healthScore: { select: { id: true } } },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      }),
      this.prisma.serviceBay.findMany({ where: { id: { in: rows.flatMap(r => r.bayId ? [r.bayId] : []) } }, select: { id: true, name: true } }),
      this.prisma.checklistVersion.findMany({
        where: { id: { in: rows.flatMap((row) => row.inspectionTemplateVersionId ? [row.inspectionTemplateVersionId] : []) } },
        include: { template: { select: { name: true, scope: true } } },
      }),
    ]);
    return rows.map(r => {
      const report = reports.find(i => i.appointmentId === r.id);
      const inspectionRequired = r.inspectionRequiredSnapshot ?? r.serviceType.inspectionRequired;
      const pinnedVersion = templateVersions.find((v) => v.id === r.inspectionTemplateVersionId);
      return {
        id: r.id, vehicleId: r.vehicleId, vehiclePlateNo: r.vehicle.plateNo,
        vehicleMake: r.vehicle.make, vehicleModel: r.vehicle.model, vehicleYear: r.vehicle.year,
        serviceTypeId: r.serviceTypeId, serviceTypeName: r.serviceNameSnapshot ?? r.serviceType.name,
        inspectionRequired,
        inspectionTemplateReady: !inspectionRequired || Boolean(pinnedVersion && pinnedVersion.status === "PUBLISHED"),
        inspectionScope: pinnedVersion?.template?.scope ?? null,
        canInspect: certified,
        canCompleteService: canCompleteService && !inspectionRequired && !r.repairReturnForWorkOrder && ["BOOKED", "CONFIRMED", "IN_PROGRESS"].includes(r.status),
        scheduledStart: r.scheduledStart.toISOString(), scheduledEnd: r.scheduledEnd.toISOString(),
        status: r.status, requiresPickup: r.requiresPickup, bayId: r.bayId,
        bayName: bays.find(b => b.id === r.bayId)?.name ?? null, memberName: r.vehicle.owner?.name ?? null,
        inspectionId: report?.id ?? null, scorePending: report?.scope === "FULL" && !report.healthScore,
        returnForWorkOrderId: r.repairReturnForWorkOrder?.id ?? null,
        returnInspectionId: r.repairReturnForWorkOrder?.inspectionId ?? null,
      };
    });
  }

  async fieldBookings(u: AbilityUser, q: FieldBookingQuery): Promise<FieldBookingPage> {
    this.assertStaff(u);
    let day = q.day ?? dateOf(new Date().toISOString());
    let after: { start: string; id: string } | null = null;
    if (q.cursor) {
      try {
        const c = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
        if (c.bucket !== q.bucket || !/^\d{4}-\d{2}-\d{2}$/.test(c.day) || !/^[0-9a-f-]{36}$/i.test(c.id) || !Number.isFinite(Date.parse(c.start)) || (q.day && q.day !== c.day)) throw new Error();
        day = c.day;
        after = { start: c.start, id: c.id };
      } catch { throw new DomainError("SLOT_UNAVAILABLE", "invalid booking cursor", 400); }
    }
    const midnight = new Date(toIso(day, "00:00"));
    if (!Number.isFinite(midnight.getTime()) || dateOf(midnight.toISOString()) !== day) throw new DomainError("SLOT_UNAVAILABLE", "invalid calendar date", 400);
    const tomorrow = new Date(midnight.getTime() + 86_400_000);
    const dateWhere: Prisma.AppointmentWhereInput = q.bucket === "today" ? { scheduledStart: { gte: midnight, lt: tomorrow } }
      : q.bucket === "upcoming" ? { scheduledStart: { gte: tomorrow } }
      : q.bucket === "past" ? { scheduledStart: { lt: midnight } } : {};
    const descending = q.bucket === "past";
    const afterWhere: Prisma.AppointmentWhereInput = after ? { OR: [
      { scheduledStart: descending ? { lt: new Date(after.start) } : { gt: new Date(after.start) } },
      { scheduledStart: new Date(after.start), id: descending ? { lt: after.id } : { gt: after.id } },
    ] } : {};
    const rows = await this.prisma.appointment.findMany({
      where: { AND: [dateWhere, afterWhere] }, take: q.limit + 1,
      orderBy: [{ scheduledStart: descending ? "desc" : "asc" }, { id: descending ? "desc" : "asc" }],
      include: { serviceType: true, vehicle: { include: { owner: true } }, repairReturnForWorkOrder: { select: { id: true, inspectionId: true } } },
    });
    const selected = rows.slice(0, q.limit);
    const last = selected.at(-1);
    const certified = await this.canInspect(u);
    return {
      items: await this.decorateBookings(selected, certified, ["MECHANIC", "ADVISOR", "ADMIN"].includes(u.role)), day, canInspect: certified,
      nextCursor: rows.length > q.limit && last ? Buffer.from(JSON.stringify({ bucket: q.bucket, day, start: last.scheduledStart.toISOString(), id: last.id })).toString("base64url") : null,
    };
  }

  async fieldBooking(u: AbilityUser, id: string): Promise<FieldBooking> {
    this.assertStaff(u);
    const row = await this.prisma.appointment.findUnique({ where: { id }, include: { serviceType: true, vehicle: { include: { owner: true } }, repairReturnForWorkOrder: { select: { id: true, inspectionId: true } } } });
    if (!row) throw new DomainError("SLOT_UNAVAILABLE", "booking not found", 404);
    return (await this.decorateBookings([row], await this.canInspect(u), ["MECHANIC", "ADVISOR", "ADMIN"].includes(u.role)))[0];
  }
}
