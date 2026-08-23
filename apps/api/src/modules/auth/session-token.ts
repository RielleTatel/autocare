import { createHash } from "crypto";
import { jwtDecrypt } from "jose";
import type { Role } from "@autocare/contracts";

export interface StaffSession {
  uid: string; // the API User.id (uuid), NOT the firebaseUid — see apps/web /api/session route
  role: Role;
}

/**
 * Derives the 32-byte AES key from SESSION_SECRET exactly as apps/web does (SHA-256 of the secret),
 * so this API can open the same `ac_session` cookies the web app seals. Web uses Web Crypto; Node's
 * createHash("sha256") produces the identical digest bytes.
 */
const deriveKey = (): Uint8Array | null => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new Uint8Array(createHash("sha256").update(secret).digest());
};

/**
 * Opens a jose-sealed staff session token. Returns null for anything that isn't a valid session we
 * minted (including a Firebase ID token, which simply won't decrypt) — the caller then falls back
 * to Firebase verification.
 */
export async function openStaffSession(token: string): Promise<StaffSession | null> {
  const key = deriveKey();
  if (!key) return null;
  try {
    const { payload } = await jwtDecrypt(token, key);
    if (!payload.uid || !payload.role) return null;
    return { uid: payload.uid as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
