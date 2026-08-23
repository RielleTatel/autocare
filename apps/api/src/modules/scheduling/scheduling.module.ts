import { Module } from "@nestjs/common";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { HoldsService } from "./holds.service";

@Module({
  controllers: [SchedulingController],
  providers: [SchedulingService, HoldsService],
  exports: [SchedulingService, HoldsService],
})
export class SchedulingModule {}
