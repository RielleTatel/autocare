import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FirebaseService } from "./firebase.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private firebase: FirebaseService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) throw new DomainError("AUTH_TOKEN_INVALID", "Missing bearer token", 401);

    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new DomainError("AUTH_TOKEN_INVALID", "Token invalid or expired", 401);
    }

    const user = await this.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!user) throw new DomainError("AUTH_TOKEN_INVALID", "No user for token", 401);
    if (user.status === "SUSPENDED") throw new DomainError("FORBIDDEN_ROLE", "Account suspended", 403);

    req.user = user;
    return true;
  }
}
