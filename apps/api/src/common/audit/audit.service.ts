import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../modules/prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  record(actorUserId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    return this.prisma.auditLog.create({
      data: { actorUserId, action, entityType, entityId, before: before as any, after: after as any },
    });
  }
}
