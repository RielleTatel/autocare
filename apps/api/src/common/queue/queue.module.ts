import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: "dpa" }),
    // "webhooks" backs webhooks.retryUnprocessed (Task 6) — reprocesses PspWebhookEvent rows
    // with processedAt IS NULL. Registered here so both Task 6 (processor) and Task 8 (which
    // adds the 15-min repeat schedule) can inject the same queue.
    BullModule.registerQueue({ name: "webhooks" }),
    // "billing" backs the 5 scheduled billing jobs (Task 8, §7.8) — issueInvoices/autoCharge/
    // retryFailed/evaluateStates/resetCycle. See modules/billing/.
    BullModule.registerQueue({ name: "billing" }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
