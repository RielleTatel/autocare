import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { SYNC_HANDLERS } from "./sync.types";
import { InspectionSyncHandler } from "./handlers/inspection.handler";
import { WasteSyncHandler } from "./handlers/waste.handler";
import { InspectionsModule } from "../inspections/inspections.module";

@Module({
  imports: [InspectionsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    InspectionSyncHandler,
    WasteSyncHandler,
    {
      provide: SYNC_HANDLERS,
      useFactory: (inspection: InspectionSyncHandler, waste: WasteSyncHandler) => [inspection, waste],
      inject: [InspectionSyncHandler, WasteSyncHandler],
    },
  ],
  exports: [SyncService],
})
export class SyncModule {}
