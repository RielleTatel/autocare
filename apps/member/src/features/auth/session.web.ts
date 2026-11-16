import { api } from "../../shared/api";
import { currentIdToken } from "./firebaseAuth.web";
export type BootState = "ANONYMOUS" | "NEEDS_CONSENT" | "READY";
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token || !lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS";
  return "TOKEN_OK";
}
export async function biometricGate() { return true; }
export async function bootstrap(): Promise<BootState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resolveSession = async (): Promise<BootState> => {
    try {
      const token = await currentIdToken();
      const lastActive = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("autocare_last_active_at");
      if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return "ANONYMOUS";
      const session = await api.createSession();
      sessionStorage.setItem("autocare_last_active_at", String(Date.now()));
      return session.consentRequired ? "NEEDS_CONSENT" : "READY";
    } catch { return "ANONYMOUS"; }
  };
  try {
    return await Promise.race([resolveSession(), new Promise<BootState>(resolve => { timer = setTimeout(() => resolve("ANONYMOUS"), 12000); })]);
  } finally { clearTimeout(timer); }
}
