import { Module } from "@nestjs/common";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";
import { STORAGE_PORT } from "../../common/storage/storage.port";
import { FsStorageAdapter } from "../../common/storage/fs-storage.adapter";
import { SupabaseStorageAdapter } from "../../common/storage/supabase-storage.adapter";

@Module({
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    { provide: STORAGE_PORT, useClass: process.env.NODE_ENV === "test" ? FsStorageAdapter : SupabaseStorageAdapter },
  ],
  exports: [VehiclesService],
})
export class VehiclesModule {}
