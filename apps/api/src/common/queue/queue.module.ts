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
    // "invoices" backs `invoices.generatePdf` (Task 9, FR-029) — async PDF-receipt rendering.
    // GET /invoices/:id/pdf itself generates synchronously (see InvoicesService.pdfUrl); this
    // queue exists for callers that want the render queued instead (e.g. a future email job).
    BullModule.registerQueue({ name: "invoices" }),
    // "scheduling" backs Phase 3 jobs (SchedulingScheduler): scheduling.flagNoShows (nightly) and
    // reminders.serviceDue (daily 08:00). Logic lives in AppointmentsService / RemindersService.
    BullModule.registerQueue({ name: "scheduling" }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
