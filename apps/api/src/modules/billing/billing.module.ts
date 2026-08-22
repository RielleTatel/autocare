import { Module } from "@nestjs/common";
import { QueueModule } from "../../common/queue/queue.module";
import { PaymentsModule } from "../payments/payments.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { BillingService } from "./billing.service";
import { BillingProcessor } from "./billing.processor";
import { BillingScheduler } from "./billing.scheduler";

@Module({
  imports: [QueueModule, PaymentsModule, EntitlementsModule],
  providers: [BillingService, BillingProcessor, BillingScheduler],
  exports: [BillingService],
})
export class BillingModule {}
