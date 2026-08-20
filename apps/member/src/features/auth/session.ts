import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";
import { currentIdToken } from "./firebaseAuth";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/** Pure, testable core: what does the stored state imply? */
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token) return "ANONYMOUS";
  if (!lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS"; // FR-015
  return "TOKEN_OK";
}

export type BootState = "ANONYMOUS" | "NEEDS_CONSENT" | "READY";

export async function bootstrap(): Promise<BootState> {
  const token = await currentIdToken();
  const lastActive = await SecureStore.getItemAsync("last_active_at");
  if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return "ANONYMOUS";
  try {
    const session = await api.createSession();
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
    return session.consentRequired ? "NEEDS_CONSENT" : "READY";
  } catch { return "ANONYMOUS"; }
}
