import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CLOCK, type Clock } from "../../common/clock/clock";
import { toCsv, type WasteExportRow } from "./waste-csv";

export type WasteSummary = {
  totals: Array<{ wasteType: string; quantity: number; unit: string }>;
  recordCount: number;
  lastExportedAt: string | null;
};

const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999Z`);

/** W-09 hazardous-waste reporting (DENR). Exports are audit-logged. */
@Injectable()
export class WasteExportService {
  constructor(private prisma: PrismaService, @Inject(CLOCK) private clock: Clock) {}

  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  /** Records are dated by disposal where known, falling back to capture time. */
  private async rows(from: string, to: string) {
    return this.prisma.wasteRecord.findMany({
      where: { createdAt: { gte: dayStart(from), lte: dayEnd(to) } },
      orderBy: { createdAt: "asc" },
      select: {
        wasteType: true, quantity: true, unit: true, haulerName: true, manifestNo: true,
        disposedAt: true, createdAt: true,
        workOrder: { select: { number: true, vehicle: { select: { plateNo: true } } } },
      },
    });
  }

  async summary(u: AbilityUser, from: string, to: string): Promise<WasteSummary> {
    this.assertAdmin(u);
    const rows = await this.rows(from, to);

    const byType = new Map<string, { wasteType: string; quantity: number; unit: string }>();
    for (const r of rows) {
      const existing = byType.get(r.wasteType);
      if (existing) existing.quantity += r.quantity;
      else byType.set(r.wasteType, { wasteType: r.wasteType, quantity: r.quantity, unit: r.unit });
    }

    const lastExport = await this.prisma.auditLog.findFirst({
      where: { action: "WASTE_EXPORTED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return {
      totals: [...byType.values()],
      recordCount: rows.length,
      lastExportedAt: lastExport?.createdAt.toISOString() ?? null,
    };
  }

  async exportCsv(u: AbilityUser, from: string, to: string): Promise<string> {
    this.assertAdmin(u);
    const rows = await this.rows(from, to);

    const mapped: WasteExportRow[] = rows.map((r) => ({
      disposedAt: (r.disposedAt ?? r.createdAt).toISOString().slice(0, 10),
      workOrderNumber: r.workOrder.number,
      plateNo: r.workOrder.vehicle.plateNo,
      wasteType: r.wasteType,
      quantity: r.quantity,
      unit: r.unit,
      haulerName: r.haulerName,
      manifestNo: r.manifestNo,
    }));

    // A regulator-facing document leaving the system is an auditable event.
    await this.prisma.auditLog.create({
      data: {
        actorUserId: u.id,
        action: "WASTE_EXPORTED",
        entityType: "WasteRecord",
        entityId: `${from}..${to}`,
        after: { from, to, recordCount: mapped.length, at: this.clock.now().toISOString() },
      },
    });

    return toCsv(mapped);
  }
}
