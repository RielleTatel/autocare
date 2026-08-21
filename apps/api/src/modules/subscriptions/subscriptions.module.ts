import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";

@Module({
  imports: [VehiclesModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, IdempotencyInterceptor],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
