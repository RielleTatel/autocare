import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import { CLOCK, Clock } from "../../common/clock/clock";
import { AppointmentsService } from "./appointments.service";
import { RemindersService } from "./reminders.service";
import { UtilisationService } from "./utilisation.service";

/**
 * Thin BullMQ dispatcher for the "scheduling" queue — job logic lives in the services (injected
 * clock, directly unit-testable). The repeat schedule is wired by SchedulingScheduler.
 */
@Processor("scheduling")
export class SchedulingProcessor extends WorkerHost {
  constructor(
    private appointments: AppointmentsService,
    private reminders: RemindersService,
    private utilisation: UtilisationService,
    @Inject(CLOCK) private clock: Clock,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "flagNoShows":
        await this.appointments.flagNoShows(this.clock.now());
        return;
      case "serviceDue":
        await this.reminders.serviceDue(this.clock.now());
        return;
      case "utilisationAlarm":
        await this.utilisation.utilisationAlarm(this.clock.now());
        return;
      default:
        return;
    }
  }
}
