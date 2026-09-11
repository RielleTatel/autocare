import { Inject, Injectable } from "@nestjs/common";
import type {
  RoadsideDispatchInput,
  RoadsideEligibility,
  RoadsideRequestInput,
  RoadsideRequestView,
  RoadsideResolveInput,
  RoadsideStatusInput,
} from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK, type Clock } from "../../common/clock/clock";
import { routeDistanceKm, workshopOrigin } from "./route-distance";

/**
 * BR-02 waiting period, in days, measured from the first cleared payment.
 *
 * Named rather than inlined because the MOC still carries "minimum lock-in
 * period for roadside assistance eligibility" as an open decision, while BR-02
 * and FR-034 state 30. Change here, change the tests, change nothing else.
 */
export const ROADSIDE_WAITING_DAYS = 30;

const DAY_MS = 86_400_000;

/** Roles that may work an incident. Mirrors scheduling-config.service.ts. */
const DISPATCH_ROLES = new Set(["ADVISOR", "ADMIN", "DRIVER"]);

/** FR-038 order. Index position is the rule: a transition must move forward. */
const STATUS_ORDER = ["REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE", "RESOLVED"] as const;

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

  /** Statuses before RESOLVED — a member may only have one of these at a time. */
  private static readonly OPEN_STATUSES = ["REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE"] as const;

  private view(r: {
    id: string;
    vehicleId: string;
    incidentType: string;
    lat: number;
    lng: number;
    address: string | null;
    landmarkNote: string | null;
    status: string;
    responderName: string | null;
    etaMinutes: number | null;
    createdAt: Date;
    resolvedAt: Date | null;
    distanceKm?: number | null;
  }): RoadsideRequestView {
    return {
      id: r.id,
      vehicleId: r.vehicleId,
      incidentType: r.incidentType as RoadsideRequestView["incidentType"],
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      landmarkNote: r.landmarkNote,
      status: r.status as RoadsideRequestView["status"],
      responderName: r.responderName,
      etaMinutes: r.etaMinutes,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      distanceKm: r.distanceKm ?? null,
    };
  }

  /** The member's live incident, if any. Drives M-27 and the Home card. */
  async active(userId: string): Promise<RoadsideRequestView | null> {
    const open = await this.prisma.roadsideRequest.findFirst({
      where: { userId, status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    return open ? this.view(open) : null;
  }

  async byId(userId: string, id: string): Promise<RoadsideRequestView> {
    const r = await this.prisma.roadsideRequest.findFirst({ where: { id, userId } });
    if (!r) throw new DomainError("FORBIDDEN_ROLE", "Request not found", 404);
    return this.view(r);
  }

  /**
   * FR-031 → FR-034. Eligibility is checked here rather than only in the UI:
   * the button is the one thing a member reaches for in an emergency, and it
   * must not be possible to get past it by replaying the request.
   */
  async create(userId: string, dto: RoadsideRequestInput): Promise<RoadsideRequestView> {
    const eligibility = await this.eligibility(userId);
    if (!eligibility.eligible) {
      throw new DomainError(
        "ROADSIDE_NOT_ELIGIBLE",
        eligibility.reason ?? "Roadside assistance is not available on your plan yet.",
        403,
      );
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, ownerUserId: userId },
      select: { id: true },
    });
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "That vehicle is not on your account.", 403);

    // Idempotent by situation rather than by key: a second tap during an
    // emergency means "did it work?", not "send another truck".
    const open = await this.prisma.roadsideRequest.findFirst({
      where: { userId, status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (open) return this.view(open);

    const created = await this.prisma.roadsideRequest.create({
      data: {
        userId,
        vehicleId: dto.vehicleId,
        incidentType: dto.incidentType,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address ?? null,
        landmarkNote: dto.landmarkNote ?? null,
      },
    });
    return this.view(created);
  }

  private assertDispatcher(u: AbilityUser): void {
    if (!DISPATCH_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }

  private async loadOpen(id: string) {
    const r = await this.prisma.roadsideRequest.findUnique({ where: { id } });
    if (!r) throw new DomainError("FORBIDDEN_ROLE", "Request not found", 404);
    return r;
  }

  /** FR-036 surface — open incidents, oldest first, because they are a queue. */
  async board(u: AbilityUser): Promise<RoadsideRequestView[]> {
    this.assertDispatcher(u);
    const rows = await this.prisma.roadsideRequest.findMany({
      where: { status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.view(r));
  }

  async dispatch(u: AbilityUser, id: string, dto: RoadsideDispatchInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);
    if (current.status === "RESOLVED")
      throw new DomainError("DUPLICATE_REQUEST", "That request is already resolved.", 409);

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: "DISPATCHED",
        dispatchedToUserId: dto.responderUserId ?? null,
        responderName: dto.responderName,
        etaMinutes: dto.etaMinutes ?? null,
        acknowledgedAt: current.acknowledgedAt ?? this.clock.now(),
      },
    });
    return this.view(updated);
  }

  async setStatus(u: AbilityUser, id: string, dto: RoadsideStatusInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);

    const from = STATUS_ORDER.indexOf(current.status as (typeof STATUS_ORDER)[number]);
    const to = STATUS_ORDER.indexOf(dto.status);
    if (to <= from) {
      throw new DomainError(
        "DUPLICATE_REQUEST",
        `A request cannot move from ${current.status} back to ${dto.status}.`,
        409,
      );
    }

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: dto.status,
        etaMinutes: dto.etaMinutes ?? current.etaMinutes,
        acknowledgedAt: current.acknowledgedAt ?? this.clock.now(),
        resolvedAt: dto.status === "RESOLVED" ? this.clock.now() : null,
      },
    });
    return this.view(updated);
  }

  /** FR-039 — outcome and cost, for the FR-099 roadside-cost report. */
  async resolve(u: AbilityUser, id: string, dto: RoadsideResolveInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);
    if (current.status === "RESOLVED")
      throw new DomainError("DUPLICATE_REQUEST", "That request is already resolved.", 409);

    // Best-effort (FR-039): a maps outage must not block closing the call.
    const origin = workshopOrigin();
    const distanceKm = origin ? await routeDistanceKm(origin, { lat: current.lat, lng: current.lng }) : null;

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: "RESOLVED",
        distanceKm,
        resolutionNotes: dto.resolutionNotes,
        costCentavos: BigInt(dto.costCentavos),
        resolvedAt: this.clock.now(),
      },
    });
    return this.view(updated);
  }
}
