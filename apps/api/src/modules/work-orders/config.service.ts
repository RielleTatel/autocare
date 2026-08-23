import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { DomainError } from "../../common/errors/domain-error";
import { AuditService } from "../../common/audit/audit.service";

const THRESHOLD_KEY = "work_order_approval_threshold_centavos";
const DEFAULT_THRESHOLD = 150_000; // ₱1,500 (BR-07 default D-4)

/** Reads/writes the admin-configurable approval threshold (BR-07). Falls back
 *  to the ₱1,500 default when unset. */
@Injectable()
export class WorkOrderConfigService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async approvalThresholdCentavos(): Promise<number> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: THRESHOLD_KEY } });
    if (!row) return DEFAULT_THRESHOLD;
    const n = Number(row.value);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLD;
  }

  async setApprovalThreshold(u: AbilityUser, centavos: number): Promise<{ thresholdCentavos: number }> {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
    if (!Number.isInteger(centavos) || centavos < 0) throw new DomainError("APPROVAL_REQUIRED", "invalid threshold", 400);
    await this.prisma.systemConfig.upsert({
      where: { key: THRESHOLD_KEY },
      update: { value: String(centavos) },
      create: { key: THRESHOLD_KEY, value: String(centavos) },
    });
    await this.audit.record(u.id, "WO_THRESHOLD_UPDATED", "SystemConfig", THRESHOLD_KEY, null, { centavos });
    return { thresholdCentavos: centavos };
  }
}
