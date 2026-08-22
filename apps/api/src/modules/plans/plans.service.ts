import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PlanCreate, PlanUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { DomainError } from "../../common/errors/domain-error";

const PLAN_SELECT = {
  id: true,
  code: true,
  name: true,
  priceCentavos: true,
  billingInterval: true,
  lockInMonths: true,
  isActive: true,
  version: true,
  entitlements: {
    select: { id: true, entitlementType: true, quantityPerCycle: true, overagePriceCentavos: true },
  },
} as const;

type PlanRow = Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>;

/** Maps Prisma BigInt centavo columns to plain numbers for the wire (money crosses the wire as JS number). */
const toPlanResponse = (row: PlanRow) => ({
  ...row,
  priceCentavos: Number(row.priceCentavos),
  entitlements: row.entitlements.map((e) => ({ ...e, overagePriceCentavos: Number(e.overagePriceCentavos) })),
});

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async listActive() {
    const rows = await this.prisma.plan.findMany({
      where: { isActive: true },
      select: PLAN_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPlanResponse);
  }

  async listAll() {
    const rows = await this.prisma.plan.findMany({
      select: PLAN_SELECT,
      orderBy: [{ code: "asc" }, { version: "asc" }],
    });
    return rows.map(toPlanResponse);
  }

  async create(actorId: string, dto: PlanCreate) {
    const row = await this.prisma.plan.create({
      data: {
        code: dto.code,
        name: dto.name,
        priceCentavos: BigInt(dto.priceCentavos),
        billingInterval: dto.billingInterval,
        lockInMonths: dto.lockInMonths,
        version: 1,
        entitlements: {
          create: dto.entitlements.map((e) => ({
            entitlementType: e.entitlementType,
            quantityPerCycle: e.quantityPerCycle,
            overagePriceCentavos: BigInt(e.overagePriceCentavos),
          })),
        },
      },
      select: PLAN_SELECT,
    });
    const response = toPlanResponse(row);
    await this.audit.record(actorId, "PLAN_CREATED", "Plan", row.id, null, response);
    return response;
  }

  async update(actorId: string, id: string, dto: PlanUpdate) {
    const current = await this.prisma.plan.findUnique({ where: { id }, select: PLAN_SELECT });
    if (!current) throw new DomainError("FORBIDDEN_ROLE", "Plan not found", 404);

    const merged = {
      code: dto.code ?? current.code,
      name: dto.name ?? current.name,
      priceCentavos: dto.priceCentavos !== undefined ? BigInt(dto.priceCentavos) : current.priceCentavos,
      billingInterval: dto.billingInterval ?? current.billingInterval,
      lockInMonths: dto.lockInMonths ?? current.lockInMonths,
      entitlements: dto.entitlements ?? current.entitlements.map((e) => ({
        entitlementType: e.entitlementType,
        quantityPerCycle: e.quantityPerCycle,
        overagePriceCentavos: Number(e.overagePriceCentavos),
      })),
    };

    const [, newRow] = await this.prisma.$transaction([
      this.prisma.plan.update({ where: { id: current.id }, data: { isActive: false } }),
      this.prisma.plan.create({
        data: {
          code: merged.code,
          name: merged.name,
          priceCentavos: merged.priceCentavos,
          billingInterval: merged.billingInterval,
          lockInMonths: merged.lockInMonths,
          version: current.version + 1,
          entitlements: {
            create: merged.entitlements.map((e) => ({
              entitlementType: e.entitlementType,
              quantityPerCycle: e.quantityPerCycle,
              overagePriceCentavos: BigInt(e.overagePriceCentavos),
            })),
          },
        },
        select: PLAN_SELECT,
      }),
    ]);

    const before = toPlanResponse(current);
    const after = toPlanResponse(newRow);
    await this.audit.record(actorId, "PLAN_VERSIONED", "Plan", newRow.id, before, after);
    return after;
  }
}
