import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ProfileUpdate, UserStatusUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { DomainError } from "../../common/errors/domain-error";

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
}
