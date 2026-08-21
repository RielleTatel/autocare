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
  ],
  exports: [BullModule],
})
export class QueueModule {}
