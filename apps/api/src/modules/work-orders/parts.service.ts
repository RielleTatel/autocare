import { Injectable } from "@nestjs/common";
import type { PartCreateInput, PartUpdateInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

@Injectable()
export class PartsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private assertStaff(u: AbilityUser): void {
    if (!STAFF_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }
  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  /** Search-as-you-type over SKU/name for the W-08 lookup; low-stock badge data. */
  async search(u: AbilityUser, query: string | undefined) {
    this.assertStaff(u);
    const q = (query ?? "").trim();
    const parts = await this.prisma.part.findMany({
      where: {
        isActive: true,
        ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 25,
    });
    return parts.map(this.present);
  }

  private present = (p: { sku: string; name: string; category: string; costCentavos: bigint; priceCentavos: bigint; stockQty: number; reorderLevel: number }) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    costCentavos: Number(p.costCentavos),
    priceCentavos: Number(p.priceCentavos),
    stockQty: p.stockQty,
    reorderLevel: p.reorderLevel,
    lowStock: p.stockQty <= p.reorderLevel,
  });

  async create(u: AbilityUser, dto: PartCreateInput) {
    this.assertAdmin(u);
    const part = await this.prisma.part.create({
      data: {
        sku: dto.sku, name: dto.name, category: dto.category,
        costCentavos: BigInt(dto.costCentavos), priceCentavos: BigInt(dto.priceCentavos),
        stockQty: dto.stockQty, reorderLevel: dto.reorderLevel,
      },
    });
    await this.audit.record(u.id, "PART_CREATED", "Part", part.sku, null, { sku: part.sku });
    return this.present(part);
  }

  async update(u: AbilityUser, sku: string, dto: PartUpdateInput) {
    this.assertAdmin(u);
    const existing = await this.prisma.part.findUnique({ where: { sku } });
    if (!existing) throw new DomainError("ITEM_NOT_FOUND", "part not found", 404);
    const part = await this.prisma.part.update({
      where: { sku },
      data: {
        name: dto.name, category: dto.category,
        costCentavos: dto.costCentavos != null ? BigInt(dto.costCentavos) : undefined,
        priceCentavos: dto.priceCentavos != null ? BigInt(dto.priceCentavos) : undefined,
        stockQty: dto.stockQty, reorderLevel: dto.reorderLevel,
      },
    });
    await this.audit.record(u.id, "PART_UPDATED", "Part", sku, null, dto as Record<string, unknown>);
    return this.present(part);
  }

  async lowStock(u: AbilityUser) {
    this.assertStaff(u);
    const parts = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT sku, name, category, cost_centavos, price_centavos, stock_qty, reorder_level FROM parts WHERE is_active = true AND stock_qty <= reorder_level ORDER BY name ASC`,
    );
    return parts.map((p) => ({
      sku: p.sku, name: p.name, category: p.category,
      costCentavos: Number(p.cost_centavos), priceCentavos: Number(p.price_centavos),
      stockQty: p.stock_qty, reorderLevel: p.reorder_level, lowStock: true,
    }));
  }
}
