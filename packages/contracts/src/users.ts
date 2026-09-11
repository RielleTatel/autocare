import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  emergencyContactName: z.string().max(120).optional(),
  emergencyContactMobile: z.string().regex(/^\+63\d{10}$/, "Use +63 format, e.g. +639171234567").optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const consentSchema = z.object({ policyVersion: z.string().min(1) });

export const userStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().min(5).max(300),
});
export type UserStatusUpdate = z.infer<typeof userStatusUpdateSchema>;

/**
 * Role assignment. There is no self-serve path to a staff role — sign-up always
 * creates a MEMBER — so this is how someone becomes (or stops being) staff.
 *
 * `reason` is required and audited, mirroring userStatusUpdateSchema: changing
 * what a person can see and do is a privileged act, and "who made this a
 * mechanic, and why" needs to be answerable later.
 */
export const userRoleUpdateSchema = z.object({
  role: z.enum(["MEMBER", "FLEET_MANAGER", "MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]),
  reason: z.string().min(5).max(300),
});
export type UserRoleUpdate = z.infer<typeof userRoleUpdateSchema>;

/** Directory row for the admin staff screen. Deliberately narrow — enough to
 *  identify a person and act on them, no profile or contact detail beyond it. */
export interface StaffDirectoryUser {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  /** Upcoming roster entries; shown so a demotion's effect is visible up front. */
  upcomingShifts: number;
}

export const staffQuerySchema = z.object({
  /** Case-insensitive match on name or email. */
  q: z.string().max(120).optional(),
  /** Omit to list staff only; "ALL" also returns members, for promoting someone. */
  scope: z.enum(["STAFF", "ALL"]).default("STAFF"),
});
export type StaffQuery = z.infer<typeof staffQuerySchema>;
