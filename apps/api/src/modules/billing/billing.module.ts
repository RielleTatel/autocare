import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { PaymentsModule } from "../payments/payments.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { BillingService } from "./billing.service";
import { BillingProcessor } from "./billing.processor";
import { BillingScheduler } from "./billing.scheduler";
import { FinalBillingController } from "./final-billing.controller";
import { FinalBillingService } from "./final-billing.service";

@Module({
  imports: [QueueModule, PaymentsModule, EntitlementsModule],
  controllers: [FinalBillingController],
  providers: [BillingService, BillingProcessor, BillingScheduler, FinalBillingService],
  exports: [BillingService],
})
export class BillingModule {}
