import { Module } from "@nestjs/common";
import { AnnouncementsModule } from "../announcements/announcements.module";
import { AttentionController } from "./attention.controller";
import { AttentionService } from "./attention.service";

@Module({
  imports: [AnnouncementsModule],
  controllers: [AttentionController],
  providers: [AttentionService],
  exports: [AttentionService],
})
export class AttentionModule {}
