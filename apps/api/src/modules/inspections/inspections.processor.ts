import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import { CLOCK, Clock } from "../../common/clock/clock";
import { InspectionsService } from "./inspections.service";

/** Thin dispatcher for the "inspections" queue — logic lives in the service
 *  (injected clock, unit-testable at the day-90/91 boundary). */
@Processor("inspections")
export class InspectionsProcessor extends WorkerHost {
  constructor(private inspections: InspectionsService, @Inject(CLOCK) private clock: Clock) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === "markStale") {
      await this.inspections.markStale(this.clock.now());
    }
  }
}
