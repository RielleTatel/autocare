import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

const MANILA_TZ = "Asia/Manila";

/**
 * Production cron wiring for the billing jobs (§7.8) — registers BullMQ repeatable jobs at
 * bootstrap. Deliberately separate from BillingProcessor/BillingService: tests invoke the
 * processor/service methods directly with an injected clock and must NEVER spawn real repeat
 * timers (they'd keep the jest/worker process alive — an open-handle leak), so this is guarded to
 * a no-op whenever `NODE_ENV === "test"`.
 *
 * `webhooks.retryUnprocessed` (Task 6 handoff — see webhooks.processor.ts) is scheduled here too,
 * on the "webhooks" queue Task 6 already registered: its 15-minute repair pass for
 * `PspWebhookEvent` rows stuck with `processedAt IS NULL`.
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    @InjectQueue("billing") private billingQueue: Queue,
    @InjectQueue("webhooks") private webhooksQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;

    await this.billingQueue.upsertJobScheduler("billing.resetCycle", { pattern: "30 0 * * *", tz: MANILA_TZ }, { name: "resetCycle" });
    await this.billingQueue.upsertJobScheduler("billing.issueInvoices", { pattern: "0 1 * * *", tz: MANILA_TZ }, { name: "issueInvoices" });
    await this.billingQueue.upsertJobScheduler("billing.autoCharge", { pattern: "0 2 * * *", tz: MANILA_TZ }, { name: "autoCharge" });
    await this.billingQueue.upsertJobScheduler("billing.retryFailed", { pattern: "0 3 * * *", tz: MANILA_TZ }, { name: "retryFailed" });
    await this.billingQueue.upsertJobScheduler("billing.evaluateStates", { pattern: "0 4 * * *", tz: MANILA_TZ }, { name: "evaluateStates" });
    await this.webhooksQueue.upsertJobScheduler("webhooks.retryUnprocessed", { pattern: "*/15 * * * *", tz: MANILA_TZ }, { name: "retryUnprocessed" });

    this.logger.log("Billing + webhook-retry repeat schedules registered (Asia/Manila)");
  }
}
