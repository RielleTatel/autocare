import { ApiError } from "@autocare/api-client";
import { kvGet, kvSet } from "../../shared/db/kv";
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
