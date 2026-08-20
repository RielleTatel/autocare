import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";
import type { Role } from "@autocare/contracts";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/** Pure, testable core: what does the stored state imply? */
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token) return "ANONYMOUS";
  if (!lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS";
  return "TOKEN_OK";
}

export type StaffBootState =
  | { state: "ANONYMOUS" }
  | { state: "READY"; name: string | null; role: Role };

export async function bootstrapStaff(): Promise<StaffBootState> {
  const token = await SecureStore.getItemAsync("firebase_id_token");
  const lastActive = await SecureStore.getItemAsync("last_active_at");
  if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return { state: "ANONYMOUS" };
  try {
    const session = await api.createSession();
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
    return { state: "READY", name: session.user.name, role: session.user.role };
  } catch {
    return { state: "ANONYMOUS" };
  }
}
