import { Module } from "@nestjs/common";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { WasteController } from "./waste.controller";
import { WasteExportService } from "./waste-export.service";

@Module({
  imports: [SchedulingModule],
  controllers: [AnalyticsController, WasteController],
  providers: [AnalyticsService, WasteExportService],
  exports: [AnalyticsService, WasteExportService],
})
export class AnalyticsModule {}
