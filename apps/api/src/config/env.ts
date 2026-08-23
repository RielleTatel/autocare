import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  POLICY_VERSION: z.string().min(1),
  // Shared with the Next.js staff web app: the API opens the same jose-sealed `ac_session` cookie
  // (see auth.guard) so desk-bound staff surfaces can authenticate without a Firebase token. Must
  // be byte-identical to apps/web SESSION_SECRET. 32+ chars (SHA-256 derives the AES key from it).
  SESSION_SECRET: z.string().min(32),
  // Optional so tests (which use the fake provider adapter, see payments.module.ts) don't need
  // real PayMongo credentials. The real adapter throws at call-time in production if unset.
  PAYMONGO_SECRET_KEY: z.string().min(1).optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(1).optional(),
});
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (): Env => envSchema.parse(process.env);
