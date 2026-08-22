import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { InvoicesService } from "./invoices.service";

/**
 * `invoices.generatePdf` (queue "invoices") — async entry point for rendering + storing an
 * invoice's PDF receipt, for callers that want it queued rather than generated inline (e.g. a
 * future "email the receipt on issue" job). `GET /invoices/:id/pdf` does NOT go through this
 * queue — see InvoicesService.pdfUrl's doc comment for why synchronous generation was chosen
 * for that endpoint. Both paths share InvoicesService.renderAndStore so there is exactly one
 * render+persist implementation.
 */
@Processor("invoices")
export class InvoicesPdfProcessor extends WorkerHost {
  constructor(private invoices: InvoicesService) {
    super();
  }

  async process(job: Job<{ invoiceId: string }>) {
    if (job.name !== "generatePdf") return;
    const row = await this.invoices.loadForRender(job.data.invoiceId);
    await this.invoices.renderAndStore(row);
  }
}
