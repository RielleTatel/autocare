import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { PROVIDER_PORT, ProviderPort } from "./provider.port";

/**
 * Registers the "webhooks" queue processor for `webhooks.retryUnprocessed` (brief §Webhook
 * controller): reprocesses `PspWebhookEvent` rows with `processedAt IS NULL`, incrementing
 * `attempts`. This task (Task 6) registers the queue (see common/queue/queue.module.ts) and this
 * processor; Task 8 (billing jobs) is expected to add the 15-minute repeat schedule that
 * actually enqueues the `retryUnprocessed` job on a timer — that wiring does not exist yet.
 *
 * Signature is NOT re-verified on retry (it was already verified once, before the row was ever
 * inserted) — the stored rawPayload is re-mapped to a PspEvent via `ProviderPort.mapEvent`
 * (injected via PROVIDER_PORT, not a concrete adapter import), so the retry path stays
 * provider-agnostic: it goes through whichever adapter is env-selected (fake in tests, real
 * PayMongo in prod) and parses the payload shape that adapter actually produces.
 */
@Processor("webhooks")
export class WebhooksProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    @Inject(PROVIDER_PORT) private provider: ProviderPort,
  ) {
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
      // Race guard: between the findMany above and this iteration, the row may have been
      // processed by a normal webhook delivery (or a concurrent retry run) in the meantime.
      // Only claim it — and only reprocess it — if it is STILL unprocessed (processedAt IS
      // NULL) at claim time; a conditional updateMany is the atomic check-and-claim. A
      // null-processedAt row must always remain reprocessable; a row that has since gained a
      // processedAt must never be treated as pending and reprocessed again.
      const claimed = await this.prisma.pspWebhookEvent.updateMany({
        where: { id: row.id, processedAt: null },
        data: { attempts: { increment: 1 } },
      });
      if (claimed.count === 0) continue; // already processed elsewhere since the read above

      const event = this.provider.mapEvent(row.rawPayload);
      await this.payments.processEvent(event, row.id);
    }
  }
}
