import { Injectable } from "@nestjs/common";
import type { BayInput, BlockInput, OperatingHoursInput, ServiceTypeInput, ShiftInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { toIso } from "./time";

const STAFF_ROLES = new Set(["ADVISOR", "ADMIN"]);

export type BoardAppointment = {
  id: string;
  bayId: string | null;
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
    return this.prisma.staffShift.create({
      data: { userId: dto.userId, date: dto.date, startTime: dto.startTime, endTime: dto.endTime, skills: dto.skills },
    });
  }

  // ---- Blocks (maintenance/holiday) ----
  async createBlock(u: AbilityUser, dto: BlockInput) {
    this.assertStaff(u);
    return this.prisma.capacityBlock.create({
      data: { bayId: dto.bayId ?? null, date: dto.date, startTime: dto.startTime, endTime: dto.endTime, reason: dto.reason, createdBy: u.id },
    });
  }

  // ---- Operating hours (upsert by weekday or by dateOverride) ----
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
      id: r.id, bayId: r.bayId, serviceTypeId: r.serviceTypeId, serviceTypeName: r.serviceType.name,
      scheduledStart: r.scheduledStart.toISOString(), scheduledEnd: r.scheduledEnd.toISOString(),
      status: r.status, requiresPickup: r.requiresPickup,
      vehiclePlateNo: r.vehicle.plateNo, memberName: r.vehicle.owner?.name ?? null,
    }));
  }
}
