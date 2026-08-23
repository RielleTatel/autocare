import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { SchedulingController } from "./scheduling.controller";
import { AppointmentsController } from "./appointments.controller";
import { SchedulingService } from "./scheduling.service";
import { HoldsService } from "./holds.service";
import { AppointmentsService } from "./appointments.service";
import { SchedulingProcessor } from "./scheduling.processor";
import { SchedulingScheduler } from "./scheduling.scheduler";

@Module({
  imports: [QueueModule, EntitlementsModule],
  controllers: [SchedulingController, AppointmentsController],
  providers: [SchedulingService, HoldsService, AppointmentsService, SchedulingProcessor, SchedulingScheduler],
  exports: [SchedulingService, HoldsService, AppointmentsService],
})
export class SchedulingModule {}
