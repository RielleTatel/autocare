import { z } from "zod";
export const roles = ["MEMBER", "FLEET_MANAGER", "MECHANIC", "ADVISOR", "DRIVER", "ADMIN"] as const;
export type Role = (typeof roles)[number];
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(), firebaseUid: z.string(), name: z.string().nullable(),
    mobile: z.string().nullable(), email: z.string().nullable(), role: z.enum(roles),
  }),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
