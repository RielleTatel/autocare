import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

const MANILA_TZ = "Asia/Manila";

/**
 * Registers the repeatable Phase 3 job schedules on the "scheduling" queue at bootstrap. Kept
 * separate from the processor so tests can invoke the underlying service methods directly without a
 * live queue (same split as BillingScheduler / BillingProcessor).
 */
@Injectable()
export class SchedulingScheduler implements OnModuleInit {
  constructor(@InjectQueue("scheduling") private queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "scheduling.flagNoShows",
      { pattern: "0 5 * * *", tz: MANILA_TZ },
      { name: "flagNoShows" },
    );
    await this.queue.upsertJobScheduler(
      "reminders.serviceDue",
      { pattern: "0 8 * * *", tz: MANILA_TZ },
      { name: "serviceDue" },
    );
    await this.queue.upsertJobScheduler(
      "capacity.utilisationAlarm",
      { pattern: "0 6 * * *", tz: MANILA_TZ },
      { name: "utilisationAlarm" },
    );
  }
}
