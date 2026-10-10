import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  // Read only by the Prisma CLI (schema.prisma `directUrl`) for `migrate deploy`, never at
  // runtime — validated here anyway so a deploy missing it fails at boot rather than at the
  // next migration.
  DIRECT_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  // Render supplies PORT. API_PORT remains the local development fallback.
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  POLICY_VERSION: z.string().min(1),
  // Shared with the Next.js staff web app: the API opens the same jose-sealed `ac_session` cookie
  // (see auth.guard) so desk-bound staff surfaces can authenticate without a Firebase token. Must
  // be byte-identical to apps/web SESSION_SECRET. 32+ chars (SHA-256 derives the AES key from it).
  SESSION_SECRET: z.string().min(32),
  // Optional so tests (which use the fake provider adapter, see payments.module.ts) don't need
  // real PayMongo credentials. Live keys are disabled throughout this integration phase.
  PAYMONGO_SECRET_KEY: z.string().startsWith("sk_test_").optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYMONGO_SUCCESS_URL: z.string().url().startsWith("https://").optional(),
  PAYMONGO_CANCEL_URL: z.string().url().startsWith("https://").optional(),
  // route-distance.ts reads these straight off process.env at call time (FR-039). Validating
  // them here is what makes a missing one fail the deploy instead of failing the first roadside
  // request on a service that otherwise looks healthy.
  MAPBOX_TOKEN: z.string().min(1),
  WORKSHOP_LAT: z.coerce.number(),
  WORKSHOP_LNG: z.coerce.number(),
});
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (): Env => envSchema.parse(process.env);
