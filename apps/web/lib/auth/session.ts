import { EncryptJWT, jwtDecrypt } from "jose";
import type { Role } from "@autocare/contracts";

export interface StaffSession {
  uid: string;
  role: Role;
}

// jose's `dir` + `A256GCM` requires the key to be EXACTLY 32 bytes. Rather
// than requiring operators to hand-craft a 32-byte secret (an `openssl rand
// -base64 32` output is 44 chars, not 32 bytes), derive a fixed 32-byte key
// via SHA-256 from whatever secret string is configured. Uses Web Crypto
// (globalThis.crypto.subtle) so this stays edge-safe — no Node `crypto`
// import. Guard against a missing/too-short secret so misconfiguration
// fails loudly at startup rather than throwing mid-request.
const key = async () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a string of 32+ characters");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
};

export async function sealSession(s: StaffSession): Promise<string> {
  return new EncryptJWT({ uid: s.uid, role: s.role })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .encrypt(await key());
}

export async function openSession(cookie: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtDecrypt(cookie, await key());
    return { uid: payload.uid as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
