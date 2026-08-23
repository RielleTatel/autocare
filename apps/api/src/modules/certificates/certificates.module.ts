import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { STORAGE_PORT } from "../../common/storage/storage.port";
import { FsStorageAdapter } from "../../common/storage/fs-storage.adapter";
import { SupabaseStorageAdapter } from "../../common/storage/supabase-storage.adapter";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";
import { CertificatesPdfProcessor } from "./certificates.pdf.processor";

@Module({
  imports: [QueueModule],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CertificatesPdfProcessor,
    { provide: STORAGE_PORT, useClass: process.env.NODE_ENV === "test" ? FsStorageAdapter : SupabaseStorageAdapter },
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}
