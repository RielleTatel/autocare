import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoicesPdfProcessor } from "./invoices.pdf.processor";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { QueueModule } from "../../common/queue/queue.module";
import { STORAGE_PORT } from "../../common/storage/storage.port";
import { FsStorageAdapter } from "../../common/storage/fs-storage.adapter";
import { SupabaseStorageAdapter } from "../../common/storage/supabase-storage.adapter";

@Module({
  imports: [VehiclesModule, QueueModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesPdfProcessor,
    { provide: STORAGE_PORT, useClass: process.env.NODE_ENV === "test" ? FsStorageAdapter : SupabaseStorageAdapter },
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
