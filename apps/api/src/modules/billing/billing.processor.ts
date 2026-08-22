import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { BillingService } from "./billing.service";

/**
 * Thin BullMQ dispatcher for the "billing" queue — all actual job logic lives in
 * BillingService (directly unit/integration-testable with an injected clock). The repeat
 * schedule that enqueues these job names in production is wired by BillingScheduler.
 */
@Processor("billing")
export class BillingProcessor extends WorkerHost {
  constructor(private billing: BillingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "issueInvoices":
        await this.billing.issueInvoices();
        return;
      case "autoCharge":
        await this.billing.autoCharge();
        return;
      case "retryFailed":
        await this.billing.retryFailed();
        return;
      case "evaluateStates":
        await this.billing.evaluateStates();
        return;
      case "resetCycle":
        await this.billing.resetCycle();
        return;
    }
  }
}
