import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";
import type { Role } from "@autocare/contracts";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
const BOOT_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), BOOT_TIMEOUT_MS);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/** Pure, testable core: what does the stored state imply? */
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token) return "ANONYMOUS";
  if (!lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS";
  return "TOKEN_OK";
}

export type StaffBootState =
  | { state: "ANONYMOUS" }
  | { state: "READY"; id: string; name: string | null; role: Role };

export async function bootstrapStaff(): Promise<StaffBootState> {
  return withTimeout((async () => {
    const token = await SecureStore.getItemAsync("firebase_id_token");
    const lastActive = await SecureStore.getItemAsync("last_active_at");
    if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return { state: "ANONYMOUS" };
    try {
      const session = await api.createSession();
      await SecureStore.setItemAsync("last_active_at", String(Date.now()));
      return { state: "READY", id: session.user.id, name: session.user.name, role: session.user.role };
    } catch {
      return { state: "ANONYMOUS" };
    }
  })(), { state: "ANONYMOUS" });
}
