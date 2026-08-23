import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);
const OPEN_STATES = ["OPEN", "QUOTED", "DECLINED", "DEFERRED"] as const;

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  private async assertCanReadVehicle(u: AbilityUser, vehicleId: string): Promise<void> {
    if (STAFF_ROLES.has(u.role)) return;
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new DomainError("WORK_ORDER_NOT_FOUND", "vehicle not found", 404);
    const owns = vehicle.ownerUserId === u.id || (u.orgId != null && vehicle.orgOwnerId === u.orgId);
    if (!owns) throw new DomainError("FORBIDDEN_ROLE", "not your vehicle", 403);
  }

  /** Open recommendations for a vehicle (advisor quote tray + member M-18). */
  async listForVehicle(u: AbilityUser, vehicleId: string, includeResolved = false) {
    await this.assertCanReadVehicle(u, vehicleId);
    const recs = await this.prisma.recommendation.findMany({
      where: { vehicleId, ...(includeResolved ? {} : { status: { in: [...OPEN_STATES, "APPROVED"] } }) },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    return recs.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      pointCode: r.pointCode,
      label: r.label,
      severity: r.severity,
      recommendation: r.recommendation,
      estimatedCostCentavos: r.estimatedCostCentavos != null ? Number(r.estimatedCostCentavos) : null,
      status: r.status,
      resurfacedCount: r.resurfacedCount,
      createdAt: r.createdAt,
    }));
  }

  /** FR-069 resurfacing: called inside the Phase-4 inspection-submit transaction
   *  for each new adverse finding. If an unresolved recommendation already exists
   *  for this vehicle+point, re-link it to the new score and bump resurfacedCount
   *  instead of creating a duplicate; returns true when it handled the finding. */
  async resurfaceOrSkip(
    tx: Prisma.TransactionClient,
    input: { vehicleId: string; pointCode: string; healthScoreId: string; label: string; severity: string; recommendation: string },
  ): Promise<boolean> {
    const existing = await tx.recommendation.findFirst({
      where: { vehicleId: input.vehicleId, pointCode: input.pointCode, status: { in: [...OPEN_STATES] } },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) return false;
    await tx.recommendation.update({
      where: { id: existing.id },
      data: {
        healthScoreId: input.healthScoreId,
        label: input.label,
        severity: input.severity as any,
        recommendation: input.recommendation,
        resurfacedCount: { increment: 1 },
        // a previously declined/deferred item comes back as OPEN needing a fresh decision
        status: "OPEN",
      },
    });
    return true;
  }
}
