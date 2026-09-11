import { Inject, Injectable } from "@nestjs/common";
import type { RoadsideEligibility } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK, type Clock } from "../../common/clock/clock";

/**
 * BR-02 waiting period, in days, measured from the first cleared payment.
 *
 * Named rather than inlined because the MOC still carries "minimum lock-in
 * period for roadside assistance eligibility" as an open decision, while BR-02
 * and FR-034 state 30. Change here, change the tests, change nothing else.
 */
export const ROADSIDE_WAITING_DAYS = 30;

const DAY_MS = 86_400_000;

/** Statuses that still count as covered. GRACE keeps a late payer covered. */
const COVERED_STATUSES = ["ACTIVE", "GRACE"] as const;

@Injectable()
export class RoadsideService {
  constructor(
    private prisma: PrismaService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  /**
   * FR-034 / FR-035 — may this member raise a request, and if not, why not in
   * words they can act on. Never returns a bare "no": every refusal carries
   * either a date or an alternative.
   */
  async eligibility(userId: string): Promise<RoadsideEligibility> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...COVERED_STATUSES] } },
      select: { id: true, status: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    });

    if (!subscription) {
      return {
        eligible: false,
        reason:
          "Roadside assistance comes with an active subscription. Start a plan and it unlocks after your first payment clears.",
      };
    }

    // BR-02 is measured from money actually clearing, not from signup: a
    // subscription can exist for months with a failed card behind it.
    const firstCleared = await this.prisma.payment.findFirst({
      where: { status: "SUCCEEDED", invoice: { subscriptionId: subscription.id } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (!firstCleared) {
      return {
        eligible: false,
        reason: "Roadside assistance unlocks once your first payment clears. We'll let you know as soon as it does.",
      };
    }

    const opensAt = new Date(firstCleared.createdAt.getTime() + ROADSIDE_WAITING_DAYS * DAY_MS);
    if (this.clock.now() < opensAt) {
      return {
        eligible: false,
        eligibleFrom: opensAt.toISOString(),
        reason: `Roadside assistance opens ${ROADSIDE_WAITING_DAYS} days after your first payment. You're covered from ${opensAt
          .toISOString()
          .slice(0, 10)}.`,
      };
    }

    return { eligible: true };
  }
}
