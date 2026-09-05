import { ApiClient } from "@autocare/api-client";

/**
 * Declared locally rather than imported from @autocare/contracts, matching the other member
 * API clients (see attentionApi.ts) — the RN bundle deliberately does not pull the contracts
 * package.
 */
export type AnnouncementKind =
  | "SERVICE_DUE"
  | "APPOINTMENT_BOOKED"
  | "APPOINTMENT_REMINDER"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "SERVICE_COMPLETED"
  | "ADMIN_BROADCAST";

export type AnnouncementStatus = "ACTIVE" | "SUPERSEDED" | "DISMISSED";

export type AnnouncementItem = {
  id: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  title: string;
  body: string;
  vehicleId: string | null;
  /** Present only when the member has more than one vehicle. */
  plate?: string;
  serviceTypeId: string | null;
  appointmentId: string | null;
  publishedAt: string;
  read: boolean;
};

export type AnnouncementFeed = { items: AnnouncementItem[]; unreadCount: number };

export function makeAnnouncementsApi(api: ApiClient) {
  return {
    mine: () => api.get<AnnouncementFeed>("/me/announcements"),
    markRead: (id: string) => api.post<{ ok: true }>(`/announcements/${id}/read`, {}),
    markAllRead: () => api.post<{ ok: true }>("/announcements/read-all", {}),
  };
}
export type AnnouncementsApi = ReturnType<typeof makeAnnouncementsApi>;
