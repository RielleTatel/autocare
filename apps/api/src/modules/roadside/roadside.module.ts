import { Module } from "@nestjs/common";
import { RoadsideService } from "./roadside.service";
import { RoadsideController } from "./roadside.controller";
import { RoadsideDispatchController } from "./roadside-dispatch.controller";

// No `imports` array: ClockModule and PrismaModule are both @Global(), so
// @Inject(CLOCK) and PrismaService resolve without importing them here. Adding
// them would work but breaks the pattern every other module follows.
@Module({
  controllers: [RoadsideController, RoadsideDispatchController],
  providers: [RoadsideService],
  exports: [RoadsideService],
})
export class RoadsideModule {}
