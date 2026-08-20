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
