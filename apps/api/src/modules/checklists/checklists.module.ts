import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { ChecklistsController } from "./checklists.controller";
import { ChecklistsService } from "./checklists.service";

@Module({
  controllers: [ChecklistsController],
  providers: [ChecklistsService, AuditService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
