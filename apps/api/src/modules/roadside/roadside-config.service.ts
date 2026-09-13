import { Injectable } from "@nestjs/common";
import type { RoadsideEligibilityConfig, RoadsideEligibilityConfigUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { DomainError } from "../../common/errors/domain-error";

const WAITING_DAYS_KEY = "roadside_waiting_days";
const REQUIRE_PAYMENT_KEY = "roadside_require_cleared_payment";
export const DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG: RoadsideEligibilityConfig = {
  waitingDays: 30,
  requireClearedPayment: true,
};

function parseWaitingDays(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG.waitingDays;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 365
    ? parsed
    : DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG.waitingDays;
}

function parseRequirePayment(value: string | undefined): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG.requireClearedPayment;
}

/** Global, audited roadside eligibility policy. Invalid persisted values fail
 * closed to the documented defaults rather than making roadside unavailable. */
@Injectable()
export class RoadsideConfigService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async get(): Promise<RoadsideEligibilityConfig> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: [WAITING_DAYS_KEY, REQUIRE_PAYMENT_KEY] } },
      select: { key: true, value: true },
    });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      waitingDays: parseWaitingDays(values.get(WAITING_DAYS_KEY)),
      requireClearedPayment: parseRequirePayment(values.get(REQUIRE_PAYMENT_KEY)),
    };
  }

  async set(actor: AbilityUser, dto: RoadsideEligibilityConfigUpdate): Promise<RoadsideEligibilityConfig> {
    if (actor.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
    const before = await this.get();
    const after: RoadsideEligibilityConfig = {
      waitingDays: dto.waitingDays,
      requireClearedPayment: dto.requireClearedPayment,
    };
    await this.prisma.$transaction([
      this.prisma.systemConfig.upsert({
        where: { key: WAITING_DAYS_KEY },
        update: { value: String(after.waitingDays) },
        create: { key: WAITING_DAYS_KEY, value: String(after.waitingDays) },
      }),
      this.prisma.systemConfig.upsert({
        where: { key: REQUIRE_PAYMENT_KEY },
        update: { value: String(after.requireClearedPayment) },
        create: { key: REQUIRE_PAYMENT_KEY, value: String(after.requireClearedPayment) },
      }),
    ]);
    await this.audit.record(
      actor.id,
      "ROADSIDE_ELIGIBILITY_CONFIG_UPDATED",
      "SystemConfig",
      "roadside_eligibility",
      before,
      { ...after, reason: dto.reason },
    );
    return after;
  }
}
