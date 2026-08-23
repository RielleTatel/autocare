import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";
import { WorkOrderConfigService } from "./config.service";
import { WorkOrderEvents } from "./work-order-events";
import { WorkOrderBillingService } from "./billing.service";
import { RecommendationsService } from "./recommendations.service";
import { PartsService } from "./parts.service";

@Module({
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrderConfigService,
    WorkOrderEvents,
    WorkOrderBillingService,
    RecommendationsService,
    PartsService,
    AuditService,
  ],
  exports: [WorkOrdersService, RecommendationsService, WorkOrderEvents, WorkOrderConfigService, PartsService],
})
export class WorkOrdersModule {}
