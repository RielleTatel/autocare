import { api, API_BASE_URL } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";

/** Namespaced by backend — see checklistCache.ts. Appointment/vehicle ids differ
 *  per database, so a list cached against one API must not be served for another. */
const KEY = `tasks:today:${API_BASE_URL}`;

export type FieldTask = {
  id: string;
  scheduledStart: string;
  vehicleId: string;
  vehiclePlateNo: string;
  serviceTypeName: string;
  memberName: string | null;
  status: string;
};

/** Manila civil date, which is what the board endpoint expects. */
export function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/**
 * Today's work from the Phase 3 advisor board. MECHANIC is inside STAFF_ROLES,
 * so this needs no API change.
 *
 * Online: refresh and overwrite the cache. Offline: serve the last download and
 * say so — a mechanic in a basement bay still needs this morning's list. Throws
 * only when there is nothing cached at all.
 */
export async function getTodaysTasks(): Promise<{ tasks: FieldTask[]; stale: boolean }> {
  const day = todayManila();
  try {
    const fresh = await api.get<FieldTask[]>(`/scheduling/board?from=${day}&to=${day}`);
    await kvSet(KEY, JSON.stringify({ day, tasks: fresh }));
    return { tasks: fresh, stale: false };
  } catch (err) {
    const cached = await kvGet(KEY);
    if (!cached) throw err;
    const parsed = JSON.parse(cached) as { day: string; tasks: FieldTask[] };
    return { tasks: parsed.tasks, stale: true };
  }
}
