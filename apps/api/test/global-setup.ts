import { assertRedisReachable } from "./preflight";

/**
 * Runs once before any suite. Keeps the "Redis is down" failure loud and instant
 * instead of a silent multi-minute hang — see ./preflight.ts for the mechanism.
 */
export default async function globalSetup(): Promise<void> {
  await assertRedisReachable(process.env.REDIS_URL);
}
