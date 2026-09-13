import { Module } from "@nestjs/common";
import { AnnouncementsModule } from "../announcements/announcements.module";
import { RoadsideService } from "./roadside.service";
import { RoadsideController } from "./roadside.controller";
import { RoadsideDispatchController } from "./roadside-dispatch.controller";
import { RoadsideConfigService } from "./roadside-config.service";
import { AuditService } from "../../common/audit/audit.service";

// No `imports` array: ClockModule and PrismaModule are both @Global(), so
// @Inject(CLOCK) and PrismaService resolve without importing them here. Adding
// them would work but breaks the pattern every other module follows.
@Module({
  imports: [AnnouncementsModule],
  controllers: [RoadsideController, RoadsideDispatchController],
  providers: [RoadsideService, RoadsideConfigService, AuditService],
  exports: [RoadsideService, RoadsideConfigService],
})
export class RoadsideModule {}
