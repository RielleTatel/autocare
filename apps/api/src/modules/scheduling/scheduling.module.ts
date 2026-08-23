import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { SchedulingController } from "./scheduling.controller";
import { AppointmentsController } from "./appointments.controller";
import { SchedulingConfigController } from "./scheduling-config.controller";
import { UtilisationController } from "./utilisation.controller";
import { SchedulingService } from "./scheduling.service";
import { HoldsService } from "./holds.service";
import { AppointmentsService } from "./appointments.service";
import { RemindersService } from "./reminders.service";
import { SchedulingConfigService } from "./scheduling-config.service";
import { UtilisationService } from "./utilisation.service";
import { SchedulingProcessor } from "./scheduling.processor";
import { SchedulingScheduler } from "./scheduling.scheduler";

@Module({
  imports: [QueueModule, EntitlementsModule],
  controllers: [SchedulingController, AppointmentsController, SchedulingConfigController, UtilisationController],
  providers: [SchedulingService, HoldsService, AppointmentsService, RemindersService, SchedulingConfigService, UtilisationService, SchedulingProcessor, SchedulingScheduler],
  exports: [SchedulingService, HoldsService, AppointmentsService, RemindersService, UtilisationService],
})
export class SchedulingModule {}
