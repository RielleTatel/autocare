import { ApiError } from "@autocare/api-client";
import { kvGet, kvSet } from "../../shared/db/kv";
import { getDb } from "../../shared/db/schema";
import { api, API_BASE_URL } from "../../shared/api";
import type { CachedChecklist } from "./draft";

/** Namespaced by backend: checklist ids are `@default(uuid())`, so the same
 *  logical checklist has different ids per database. Switching the app between
 *  backends previously left the old backend's checklist in the cache, and its
 *  version id was rejected at sync time with CHECKLIST_INVALID. */
const KEY = `checklist:active:${API_BASE_URL}`;

/** True when the failure means "the server never answered" rather than "the
 *  server answered and said no". The api-client raises ApiError("NETWORK", …, 0)
 *  for transport failures; a 5xx is treated the same way because a broken server
 *  is, for a technician in a bay, indistinguishable from being offline. */
function isUnreachable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true; // unknown/thrown-non-ApiError: fail safe to cache
  return e.status === 0 || e.status >= 500;
}

/** Online: refresh from GET /checklists/active and overwrite the cache.
 *
 *  Offline (or server down): serve the last cached copy so a bay with no signal
 *  can still work — that is the offline-first contract.
 *
 *  Server reachable but REJECTING (401/403/404): rethrow. This is the case that
 *  used to be swallowed, and it is the expensive one: if the server has no
 *  active checklist, or this device's token is dead, the cached checklist's
 *  version id may no longer exist server-side. Serving it anyway lets a
 *  technician complete an entire inspection that can only ever be rejected at
 *  sync time with CHECKLIST_INVALID. Failing loudly here costs one error
 *  message instead of a whole inspection. */
export async function getActiveChecklist(): Promise<CachedChecklist> {
  try {
    const fresh = await api.get<CachedChecklist>("/checklists/active");
    await kvSet(KEY, JSON.stringify(fresh));
    return fresh;
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    const cached = await kvGet(KEY);
    if (cached) return JSON.parse(cached) as CachedChecklist;
    throw new Error("No checklist available — connect to the internet once to download it.");
  }
}

export type BookingInspectionContext = {
  appointmentId: string;
  vehicleId: string;
  serviceName: string;
  inspectionRequired: boolean;
  configReady: boolean;
  templateVersionId: string | null;
  templateVersionLabel: string | null;
  scope: "FULL" | "FOCUSED" | "LEGACY_UNKNOWN";
  checklist: CachedChecklist | null;
  charge: {
    currency: "PHP";
    priceCentavos: number | null;
    coveredBySubscription: boolean;
    subscriptionId: string | null;
    legacyProvenance: boolean;
  };
};

/** Booked work never falls back to the global active checklist. The cached
 * context is the exact pinned booking version, usable when the bay is offline. */
export async function getBookingInspectionContext(appointmentId: string, vehicleId: string): Promise<BookingInspectionContext> {
  const key = `inspection-context:${API_BASE_URL}:${appointmentId}`;
  const cacheDb = getDb();
  let context: BookingInspectionContext;
  try {
    context = await api.get<BookingInspectionContext>(`/appointments/${encodeURIComponent(appointmentId)}/inspection-context`);
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    const cached = await (await cacheDb).getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
    if (!cached) throw new Error("Connect once to download the checks assigned to this booking.");
    context = JSON.parse(cached.value) as BookingInspectionContext;
  }
  if (context.appointmentId !== appointmentId || context.vehicleId !== vehicleId) {
    throw new Error("The inspection checks do not match this booking and vehicle. Reopen the booking.");
  }
  if (!context.inspectionRequired) throw new Error("This service does not require an inspection.");
  if (!context.configReady || !context.checklist || context.checklist.id !== context.templateVersionId) {
    throw new Error("This service needs an inspection template. Ask an admin to configure it before starting.");
  }
  await (await cacheDb).runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, JSON.stringify(context));
  return context;
}

export async function getBookingChecklist(appointmentId: string, vehicleId: string): Promise<CachedChecklist> {
  const context = await getBookingInspectionContext(appointmentId, vehicleId);
  return { ...context.checklist!, scope: context.scope, serviceName: context.serviceName };
}
