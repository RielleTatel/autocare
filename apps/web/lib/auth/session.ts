import { EncryptJWT, jwtDecrypt } from "jose";
import type { Role } from "@autocare/contracts";

export interface StaffSession {
  uid: string;
  role: Role;
}

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function sealSession(s: StaffSession): Promise<string> {
  return new EncryptJWT({ uid: s.uid, role: s.role })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .encrypt(key());
}

export async function openSession(cookie: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtDecrypt(cookie, key());
    return { uid: payload.uid as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
