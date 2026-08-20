import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";

const CONSENTING_ROLES = new Set(["MEMBER", "FLEET_MANAGER"]);

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    if (req.path.startsWith("/api/v1/auth/")) return true; // consent itself + session must stay reachable
    const user = req.user;
    if (!user || !CONSENTING_ROLES.has(user.role)) return true; // staff consent via employment
    const consent = await this.prisma.consentRecord.findFirst({
      where: { userId: user.id, policyVersion: process.env.POLICY_VERSION, withdrawnAt: null },
    });
    if (!consent) throw new DomainError("CONSENT_REQUIRED", "Please accept the current privacy policy to continue", 403);
    return true;
  }
}
