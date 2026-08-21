import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { mapPaymongoEvent } from "./paymongo.adapter";

/**
 * Registers the "webhooks" queue processor for `webhooks.retryUnprocessed` (brief §Webhook
 * controller): reprocesses `PspWebhookEvent` rows with `processedAt IS NULL`, incrementing
 * `attempts`. This task (Task 6) registers the queue (see common/queue/queue.module.ts) and this
 * processor; Task 8 (billing jobs) is expected to add the 15-minute repeat schedule that
 * actually enqueues the `retryUnprocessed` job on a timer — that wiring does not exist yet.
 *
 * Signature is NOT re-verified on retry (it was already verified once, before the row was ever
 * inserted) — the stored rawPayload is re-mapped to a PspEvent directly via mapPaymongoEvent.
 */
@Processor("webhooks")
export class WebhooksProcessor extends WorkerHost {
  constructor(private prisma: PrismaService, private payments: PaymentsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "retryUnprocessed") return;

    const unprocessed = await this.prisma.pspWebhookEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    for (const row of unprocessed) {
      await this.prisma.pspWebhookEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const event = mapPaymongoEvent(row.rawPayload);
      await this.payments.processEvent(event, row.id);
    }
  }
}
