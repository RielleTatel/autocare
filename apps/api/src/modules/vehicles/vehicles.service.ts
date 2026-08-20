import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { subject } from "@casl/ability";
import type { OdometerCreate, VehicleCreate, VehicleUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityFactory, AbilityUser, Action } from "../../common/policies/ability.factory";

const VEHICLE_SELECT = { id: true, plateNo: true, make: true, model: true, year: true, variant: true,
  engineCc: true, fuelType: true, transmission: true, color: true, vin: true, photoUrls: true,
  orCrUrls: true, currentOdometerKm: true, status: true, ownerUserId: true, orgOwnerId: true } as const;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService, private abilities: AbilityFactory) {}

  async list(user: AbilityUser) {
    if (user.role === "FLEET_MANAGER" && !user.orgId) return []; // fleet manager not yet attached to an org
    const owner = user.role === "FLEET_MANAGER" ? { orgOwnerId: user.orgId } : { ownerUserId: user.id };
    return this.prisma.vehicle.findMany({ where: { ...owner, status: "ACTIVE" }, select: VEHICLE_SELECT, orderBy: { createdAt: "asc" } });
  }

  async create(user: AbilityUser, dto: VehicleCreate) {
    const { odometerKm, ...fields } = dto;
    const owner = user.role === "FLEET_MANAGER"
      ? { orgOwnerId: user.orgId ?? undefined }
      : { ownerUserId: user.id };
    try {
      return await this.prisma.vehicle.create({
        data: { ...fields, ...owner, currentOdometerKm: odometerKm,
                odometerReadings: { create: { km: odometerKm, source: "MEMBER", recordedBy: user.id } } },
        select: VEHICLE_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new DomainError("PLATE_ALREADY_REGISTERED", `Plate ${dto.plateNo} is already registered`, 409);
      throw e;
    }
  }

  /** Loads the row and enforces row-level ability — reused by uploads (Task 7) and later phases. */
  async findForUser(user: AbilityUser, id: string, action: Action = "read") {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT });
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "Vehicle not found", 404);
    if (!this.abilities.for(user).can(action, subject("Vehicle", vehicle)))
      throw new DomainError("FORBIDDEN_ROLE", "You cannot access this vehicle", 403);
    return vehicle;
  }

  async update(user: AbilityUser, id: string, dto: VehicleUpdate) {
    await this.findForUser(user, id, "update");
    return this.prisma.vehicle.update({ where: { id }, data: dto, select: VEHICLE_SELECT });
  }

  async archive(user: AbilityUser, id: string) {
    await this.findForUser(user, id, "delete");
    return this.prisma.vehicle.update({ where: { id }, data: { status: "ARCHIVED" }, select: VEHICLE_SELECT });
  }

  async recordOdometer(user: AbilityUser, id: string, dto: OdometerCreate) {
    const vehicle = await this.findForUser(user, id, "update");
    if (dto.km < vehicle.currentOdometerKm && !dto.justification)
      throw new DomainError("ODOMETER_REGRESSION", `Reading ${dto.km} km is below the current ${vehicle.currentOdometerKm} km — add a justification`, 422);
    const [reading] = await this.prisma.$transaction([
      this.prisma.odometerReading.create({ data: { vehicleId: id, km: dto.km, source: "MEMBER", recordedBy: user.id, justification: dto.justification } }),
      this.prisma.vehicle.update({ where: { id }, data: { currentOdometerKm: dto.km } }),
    ]);
    return { id: reading.id, km: reading.km, recordedAt: reading.recordedAt.toISOString() };
  }
}
