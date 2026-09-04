import { Injectable } from "@nestjs/common";
import type { AnnouncementFeed, AnnouncementItem, BroadcastCreate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { nextThreadState, renderAnnouncementCopy, ThreadEvent } from "./announcement-thread";

export type ThreadEventInput = {
  userId: string;
  vehicleId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  event: ThreadEvent;
  appointmentId?: string;
  scheduledStart?: Date;
  reason?: string | null;
};

/**
 * Owns the Announcement table. Every thread mutation funnels through `applyThreadEvent`, which
 * defers the decision to the pure state machine and only touches the database when the machine
 * says something changed — that is what makes the repeating jobs idempotent.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async applyThreadEvent(input: ThreadEventInput): Promise<void> {
    // Matches the partial unique index (user, vehicle, service type) WHERE status = 'ACTIVE'.
    // Deliberately not filtered by kind: a thread changes kind as it transitions, and filtering
    // by kind would fail to find the very thread this event is meant to update.
    const open = await this.prisma.announcement.findFirst({
      where: {
        userId: input.userId,
        vehicleId: input.vehicleId,
        serviceTypeId: input.serviceTypeId,
        status: "ACTIVE",
      },
    });

    const current = open ? { kind: open.kind, status: open.status } : null;
    const next = nextThreadState(current, input.event);
    if (!next) return;

    const copy = renderAnnouncementCopy({
      kind: next.kind,
      serviceTypeName: input.serviceTypeName,
      scheduledStart: input.scheduledStart,
      // A later event (cancel, complete) carries no reason — keep the one the thread opened with,
      // so "due" wording stays truthful about why it was due.
      reason: input.reason ?? open?.reason ?? null,
    });

    if (!open) {
      await this.prisma.announcement.create({
        data: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          serviceTypeId: input.serviceTypeId,
          kind: next.kind,
          status: next.status,
          title: copy.title,
          body: copy.body,
          reason: input.reason ?? null,
          appointmentId: input.appointmentId ?? null,
        },
      });
      return;
    }

    await this.prisma.announcement.update({
      where: { id: open.id },
      data: {
        kind: next.kind,
        status: next.status,
        title: copy.title,
        body: copy.body,
        ...(input.appointmentId !== undefined ? { appointmentId: input.appointmentId } : {}),
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      },
    });
  }

  /** Open service-due threads, for the attention dashboard (design spec §7). */
  async activeServiceDue(vehicleIds: string[]) {
    if (vehicleIds.length === 0) return [];
    const rows = await this.prisma.announcement.findMany({
      where: { vehicleId: { in: vehicleIds }, kind: "SERVICE_DUE", status: "ACTIVE" },
    });
    const serviceTypeIds = [...new Set(rows.map((r) => r.serviceTypeId).filter((x): x is string => x !== null))];
    const types = await this.prisma.serviceType.findMany({
      where: { id: { in: serviceTypeIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(types.map((t) => [t.id, t.name]));
    return rows.map((r) => ({
      vehicleId: r.vehicleId as string,
      serviceTypeId: r.serviceTypeId as string,
      serviceTypeName: nameById.get(r.serviceTypeId as string) ?? "Service",
      publishedAt: r.publishedAt,
    }));
  }

  /** Personal threads plus live broadcasts, newest first, annotated with per-viewer read state. */
  async feed(userId: string, plates: Map<string, string>, now = new Date()): Promise<AnnouncementFeed> {
    const rows = await this.prisma.announcement.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });
    const reads = await this.prisma.announcementRead.findMany({
      where: { userId, announcementId: { in: rows.map((r) => r.id) } },
      select: { announcementId: true },
    });
    const readIds = new Set(reads.map((r) => r.announcementId));

    const items: AnnouncementItem[] = rows.map((r) => {
      const plate = r.vehicleId ? plates.get(r.vehicleId) : undefined;
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        title: r.title,
        body: r.body,
        vehicleId: r.vehicleId,
        ...(plate ? { plate } : {}),
        serviceTypeId: r.serviceTypeId,
        appointmentId: r.appointmentId,
        publishedAt: r.publishedAt.toISOString(),
        read: readIds.has(r.id),
      };
    });
    return { items, unreadCount: items.filter((i) => !i.read).length };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.announcementRead.createMany({
      data: [{ announcementId: id, userId }],
      skipDuplicates: true,
    });
  }

  async markAllRead(userId: string): Promise<void> {
    const rows = await this.prisma.announcement.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true },
    });
    if (rows.length === 0) return;
    await this.prisma.announcementRead.createMany({
      data: rows.map((r) => ({ announcementId: r.id, userId })),
      skipDuplicates: true,
    });
  }

  async dismiss(userId: string, id: string): Promise<void> {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new DomainError("FORBIDDEN_ROLE", "Announcement not found", 404);
    const next = nextThreadState({ kind: row.kind, status: row.status }, { type: "DISMISSED" });
    if (!next) return;
    await this.prisma.announcement.update({ where: { id }, data: { status: next.status } });
  }

  /** FR-107 — one row with userId null is visible to every member. */
  async broadcast(adminId: string, dto: BroadcastCreate): Promise<void> {
    await this.prisma.announcement.create({
      data: {
        userId: null,
        kind: "ADMIN_BROADCAST",
        status: "ACTIVE",
        title: dto.title,
        body: dto.body,
        createdBy: adminId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async listBroadcasts() {
    return this.prisma.announcement.findMany({
      where: { kind: "ADMIN_BROADCAST" },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
  }

  async unpublish(id: string): Promise<void> {
    await this.prisma.announcement.update({ where: { id }, data: { status: "SUPERSEDED" } });
  }
}
