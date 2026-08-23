import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FirebaseService } from "./firebase.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { openStaffSession } from "./session-token";

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

    // Staff web forwards a jose-sealed session token (uid = User.id). Try that first — it's a cheap
    // local decrypt and a Firebase ID token simply won't open. Fall back to Firebase verification
    // for the mobile apps. The API still loads the user and re-checks status regardless of path.
    const staffSession = await openStaffSession(token);
    const user = staffSession
      ? await this.prisma.user.findUnique({ where: { id: staffSession.uid } })
      : await this.prisma.user.findUnique({ where: { firebaseUid: (await this.verifyFirebase(token)).uid } });

    if (!user) throw new DomainError("AUTH_TOKEN_INVALID", "No user for token", 401);
    if (user.status === "SUSPENDED") throw new DomainError("FORBIDDEN_ROLE", "Account suspended", 403);

    req.user = user;
    return true;
  }

  private async verifyFirebase(token: string): Promise<{ uid: string }> {
    try {
      return await this.firebase.verifyIdToken(token);
    } catch {
      throw new DomainError("AUTH_TOKEN_INVALID", "Token invalid or expired", 401);
    }
  }
}
