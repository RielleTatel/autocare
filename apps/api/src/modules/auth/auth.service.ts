import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FirebaseService } from "./firebase.service";
import { DomainError } from "../../common/errors/domain-error";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private firebase: FirebaseService) {}

  async createSession(bearer?: string) {
    const token = bearer?.replace(/^Bearer /, "");
    if (!token) throw new DomainError("AUTH_TOKEN_INVALID", "Missing bearer token", 401);
    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new DomainError("AUTH_TOKEN_INVALID", "Token invalid or expired", 401);
    }
    const user = await this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {},
      create: { firebaseUid: decoded.uid, mobile: decoded.phone, email: decoded.email, role: "MEMBER" },
    });
    return {
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
      },
    };
  }
}
