import { api, API_BASE_URL } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";

export type BookingBucket = "today" | "upcoming" | "past" | "all";
export type FieldTask = {
  id: string; scheduledStart: string; scheduledEnd?: string;
  vehicleId: string; vehiclePlateNo: string; vehicleMake?: string; vehicleModel?: string; vehicleYear?: number;
  serviceTypeName: string; memberName: string | null; status: string;
  inspectionRequired?: boolean; canInspect?: boolean; inspectionId?: string | null; scorePending?: boolean;
  canCompleteService?: boolean;
  returnForWorkOrderId?: string | null; returnInspectionId?: string | null;
  bayName?: string | null; requiresPickup?: boolean;
};
export type BookingPage = { items: FieldTask[]; nextCursor: string | null; day: string; canInspect: boolean };
export function todayManila(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const manilaSchedule = (iso: string) => new Date(iso).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
export async function getBookings(bucket: BookingBucket, cursor?: string): Promise<BookingPage & { stale: boolean; downloadedAt: number; cacheError?: string }> {
  const key = `bookings:${API_BASE_URL}:${bucket}:${todayManila()}:${cursor ?? "first"}`;
  try {
    const page = await api.get<BookingPage>(`/scheduling/field-bookings?bucket=${bucket}&limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const saved = { ...page, downloadedAt: Date.now() };
    let cacheError: string | undefined;
    await kvSet(key, JSON.stringify(saved)).catch(() => { cacheError = "Offline copy could not be saved on this device. Online bookings are shown."; });
    return { ...saved, stale: false, cacheError };
  } catch (error) {
    const cached = await kvGet(key);
    if (!cached) throw error;
    return { ...JSON.parse(cached), stale: true };
  }
}
export async function getBooking(id: string): Promise<FieldTask> {
  return api.get<FieldTask>(`/scheduling/field-bookings/${encodeURIComponent(id)}`);
}
export async function getTodaysTasks(): Promise<{ tasks: FieldTask[]; stale: boolean }> {
  const page = await getBookings("today");
  return { tasks: page.items, stale: page.stale };
}
