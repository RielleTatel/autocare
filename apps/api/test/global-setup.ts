import { assertRedisReachable } from "./preflight";
import { config } from "dotenv";
import { join } from "path";

/**
 * Runs once before any suite. Keeps the "Redis is down" failure loud and instant
 * instead of a silent multi-minute hang — see ./preflight.ts for the mechanism.
 */
export default async function globalSetup(): Promise<void> {
  // Jest's setupFiles run after globalSetup. Load the API environment here too
  // so the Redis preflight checks the configured service instead of silently
  // falling back to localhost.
  config({ path: join(__dirname, "..", ".env"), quiet: true });
  await assertRedisReachable(process.env.REDIS_URL);
}
