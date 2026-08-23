import { kvGet, kvSet } from "../../shared/db/kv";
import { api } from "../../shared/api";
import type { CachedChecklist } from "./draft";

const KEY = "checklist:active";

/** Online: refresh from GET /checklists/active (server sends ETag; a stale
 *  cache is simply overwritten — versions are immutable so content per label
 *  never changes). Offline: serve the last cached copy. */
export async function getActiveChecklist(): Promise<CachedChecklist> {
  try {
    const fresh = await api.get<CachedChecklist>("/checklists/active");
    await kvSet(KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    const cached = await kvGet(KEY);
    if (cached) return JSON.parse(cached) as CachedChecklist;
    throw new Error("No checklist available — connect to the internet once to download it.");
  }
}
