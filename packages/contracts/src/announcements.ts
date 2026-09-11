import { z } from "zod";

export const announcementKinds = [
  "SERVICE_DUE",
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "SERVICE_COMPLETED",
  "ROADSIDE_UPDATE",
  "ADMIN_BROADCAST",
] as const;
export type AnnouncementKind = (typeof announcementKinds)[number];

export const announcementStatuses = ["ACTIVE", "SUPERSEDED", "DISMISSED"] as const;
export type AnnouncementStatus = (typeof announcementStatuses)[number];

/**
 * One thread as the member sees it. `read` is per-viewer rather than a column on the row,
 * because a broadcast is a single row seen by every member.
 */
export interface AnnouncementItem {
  id: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  title: string;
  body: string;
  vehicleId: string | null;
  /** Present only when the member has >1 vehicle — otherwise noise (matches FR-110). */
  plate?: string;
  serviceTypeId: string | null;
  appointmentId: string | null;
  publishedAt: string;
  read: boolean;
}

export interface AnnouncementFeed {
  items: AnnouncementItem[];
  unreadCount: number;
}

/** FR-107 admin broadcast. Audience is every member for v1 — segmentation is deferred. */
export const broadcastCreateSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  expiresAt: z.string().datetime().optional(),
});
export type BroadcastCreate = z.infer<typeof broadcastCreateSchema>;
