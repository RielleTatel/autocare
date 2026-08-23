import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Raw Redis client for scheduling holds (Task 3). Distinct from BullMQ's connection (QueueModule):
 * holds are short-lived `SET NX EX` keys, not queue jobs. `maxRetriesPerRequest: null` matches the
 * BullMQ connection option and keeps commands from throwing during brief reconnects.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });

  onModuleDestroy() {
    this.client.disconnect();
  }
}
