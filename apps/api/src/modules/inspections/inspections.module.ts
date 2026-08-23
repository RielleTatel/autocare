import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { INSPECTION_SCORING } from "../sync/handlers/inspection.handler";
import { InspectionsController } from "./inspections.controller";
import { InspectionsService } from "./inspections.service";
import { InspectionsScheduler } from "./inspections.scheduler";
import { InspectionsProcessor } from "./inspections.processor";
import { ScoreEvents } from "./score-events";
import { ScoringIntegrationService } from "./scoring-integration.service";

@Module({
  imports: [QueueModule],
  controllers: [InspectionsController],
  providers: [
    InspectionsService,
    InspectionsScheduler,
    InspectionsProcessor,
    ScoreEvents,
    ScoringIntegrationService,
    { provide: INSPECTION_SCORING, useExisting: ScoringIntegrationService },
  ],
  exports: [InspectionsService, ScoreEvents, INSPECTION_SCORING],
})
export class InspectionsModule {}
