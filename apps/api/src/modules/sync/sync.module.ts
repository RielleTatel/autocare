import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { SYNC_HANDLERS } from "./sync.types";
import { InspectionSyncHandler } from "./handlers/inspection.handler";
import { InspectionsModule } from "../inspections/inspections.module";

@Module({
  imports: [InspectionsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    InspectionSyncHandler,
    {
      provide: SYNC_HANDLERS,
      useFactory: (inspection: InspectionSyncHandler) => [inspection],
      inject: [InspectionSyncHandler],
    },
  ],
  exports: [SyncService],
})
export class SyncModule {}
