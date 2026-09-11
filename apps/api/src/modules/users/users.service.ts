import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ProfileUpdate, StaffDirectoryUser, StaffQuery, UserRoleUpdate, UserStatusUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { DomainError } from "../../common/errors/domain-error";

/** Roles that grant access to the staff console or the field app. */
const STAFF_ROLES = ["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"] as const;

const PROFILE_SELECT = {
  id: true,
  firebaseUid: true,
  name: true,
  mobile: true,
  email: true,
  role: true,
  address: true,
  emergencyContactName: true,
  emergencyContactMobile: true,
  orgId: true,
  status: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService, @InjectQueue("dpa") private dpaQueue: Queue) {}

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_SELECT });
  }
  updateMe(userId: string, dto: ProfileUpdate) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: PROFILE_SELECT });
  }
  async createDataRequest(userId: string, type: "EXPORT" | "ERASURE") {
    const req = await this.prisma.dataRequest.create({ data: { userId, type } });
    await this.dpaQueue.add(type === "EXPORT" ? "dpa.export" : "dpa.erasure", { dataRequestId: req.id });
    return { requestId: req.id, status: req.status, requestedAt: req.requestedAt.toISOString() };
  }
  async setStatus(actorId: string, targetUserId: string, dto: UserStatusUpdate) {
    const before = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { status: true } });
    if (!before) throw new DomainError("FORBIDDEN_ROLE", "No such user", 404);
    const after = await this.prisma.user.update({ where: { id: targetUserId }, data: { status: dto.status }, select: PROFILE_SELECT });
    await this.audit.record(actorId, `user.status.${dto.status.toLowerCase()}:${dto.reason}`, "User", targetUserId, before, { status: after.status });
    return after;
  }

  /**
   * Directory backing the admin staff screen. Defaults to staff only; `ALL`
   * widens to members so someone who has signed in once can be found and
   * promoted — the only route to a staff role, since sign-up always creates a
   * MEMBER.
   */
  async staffDirectory(q: StaffQuery): Promise<StaffDirectoryUser[]> {
    const search = q.q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(q.scope === "STAFF" ? { role: { in: [...STAFF_ROLES] } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, mobile: true, role: true, status: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: 100,
    });

    // Upcoming roster count per user, so the console can warn that demoting
    // someone will drop scheduled capacity.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const shiftCounts = await this.prisma.staffShift.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) }, date: { gte: today } },
      _count: { _all: true },
    });
    const byUser = new Map(shiftCounts.map((s) => [s.userId, s._count._all]));

    return users.map((u) => ({ ...u, upcomingShifts: byUser.get(u.id) ?? 0 }));
  }

  /**
   * Assign a role. Two guards, both about not locking the shop out of its own
   * console: an admin cannot change their own role (the classic way to strand
   * yourself), and the last remaining ADMIN cannot be demoted.
   *
   * Leaving a staff role also clears the person's *future* shifts, so scheduled
   * capacity reflects reality immediately. Past shifts are history and stay.
   */
  async setRole(actorId: string, targetUserId: string, dto: UserRoleUpdate) {
    if (actorId === targetUserId) {
      throw new DomainError("FORBIDDEN_ROLE", "You cannot change your own role", 403);
    }
    const before = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
    if (!before) throw new DomainError("FORBIDDEN_ROLE", "No such user", 404);

    const leavingStaff =
      (STAFF_ROLES as readonly string[]).includes(before.role) &&
      !(STAFF_ROLES as readonly string[]).includes(dto.role);

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [after, clearedShifts] = await this.prisma.$transaction(async (tx) => {
      // Checked inside the transaction, and counting admins *other than* the
      // target. The self-change guard above already stops the obvious lockout,
      // so the case this catches is two admins demoting each other at the same
      // moment: each would separately see a healthy count and both could commit,
      // leaving nobody able to administer the shop.
      if (before.role === "ADMIN" && dto.role !== "ADMIN") {
        const otherAdmins = await tx.user.count({
          where: { role: "ADMIN", status: "ACTIVE", id: { not: targetUserId } },
        });
        if (otherAdmins === 0) {
          throw new DomainError("FORBIDDEN_ROLE", "Cannot demote the last active admin", 409);
        }
      }

      const updated = await tx.user.update({ where: { id: targetUserId }, data: { role: dto.role }, select: PROFILE_SELECT });
      const cleared = leavingStaff
        ? (await tx.staffShift.deleteMany({ where: { userId: targetUserId, date: { gte: today } } })).count
        : 0;
      return [updated, cleared] as const;
    });

    await this.audit.record(
      actorId,
      `user.role.${dto.role.toLowerCase()}:${dto.reason}`,
      "User",
      targetUserId,
      before,
      { role: after.role, clearedShifts },
    );
    return { ...after, clearedShifts };
  }
}
