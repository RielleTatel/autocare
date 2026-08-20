import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";

@Processor("dpa")
export class DpaProcessor extends WorkerHost {
  constructor(private prisma: PrismaService, @Inject(STORAGE_PORT) private storage: StoragePort) {
    super();
  }

  async process(job: Job<{ dataRequestId: string }>) {
    const req = await this.prisma.dataRequest.findUniqueOrThrow({ where: { id: job.data.dataRequestId } });
    if (job.name === "dpa.export") {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: req.userId },
        include: { vehicles: { include: { odometerReadings: true } }, consents: true, dataRequests: true },
      });
      const body = Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), user }, null, 2));
      const path = `dpa-exports/${req.userId}/${req.id}.json`;
      await this.storage.putObject(path, body, "application/json");
      const resultUrl = await this.storage.createDownloadUrl(path, 7 * 24 * 3600); // 7-day expiry
      await this.prisma.dataRequest.update({ where: { id: req.id }, data: { status: "DONE", completedAt: new Date(), resultUrl } });
    } else if (job.name === "dpa.erasure") {
      // Anonymize-not-delete (Data Model §8.6): mark now; the scheduled 30-day pass (Phase 7 job) strips PII.
      await this.prisma.user.update({ where: { id: req.userId }, data: { erasureRequestedAt: new Date() } });
      await this.prisma.dataRequest.update({ where: { id: req.id }, data: { status: "DONE", completedAt: new Date() } });
    }
  }
}
