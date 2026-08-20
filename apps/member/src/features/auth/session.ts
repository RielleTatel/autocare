import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { api } from "../../shared/api";
import { currentIdToken } from "./firebaseAuth";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/** Pure, testable core: what does the stored state imply? */
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token) return "ANONYMOUS";
  if (!lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS"; // FR-015
  return "TOKEN_OK";
}

/** Gate reuse of a stored session token behind device biometrics (FR-015).
 * If the device has no biometric hardware or nothing enrolled, the token
 * alone is enough (fall through) — otherwise the user must pass a live
 * biometric check before the token is trusted. */
export async function biometricGate(): Promise<boolean> {
  const capable = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  if (!capable) return true; // no biometrics enrolled — fall through, token alone suffices
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock AutoCare+" });
  return res.success;
}

export type BootState = "ANONYMOUS" | "NEEDS_CONSENT" | "READY";

export async function bootstrap(): Promise<BootState> {
  const token = await currentIdToken();
  const lastActive = await SecureStore.getItemAsync("last_active_at");
  if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return "ANONYMOUS";
  if (!(await biometricGate())) return "ANONYMOUS";
  try {
    const session = await api.createSession();
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
    return session.consentRequired ? "NEEDS_CONSENT" : "READY";
  } catch { return "ANONYMOUS"; }
}
