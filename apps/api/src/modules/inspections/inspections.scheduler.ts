import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

const MANILA_TZ = "Asia/Manila";

/** Registers scores.markStale daily at 05:00 Manila (BR-05). */
@Injectable()
export class InspectionsScheduler implements OnModuleInit {
  constructor(@InjectQueue("inspections") private queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "scores.markStale",
      { pattern: "0 5 * * *", tz: MANILA_TZ },
      { name: "markStale" },
    );
  }
}
