import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsWebhookController } from "./payments.webhook.controller";
import { PaymentsService } from "./payments.service";
import { WebhooksProcessor } from "./webhooks.processor";
import { PROVIDER_PORT } from "./provider.port";
import { PaymongoAdapter } from "./paymongo.adapter";
import { FakeProviderAdapter } from "./fake-provider.adapter";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { QueueModule } from "../../common/queue/queue.module";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";

@Module({
  imports: [VehiclesModule, QueueModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    WebhooksProcessor,
    IdempotencyInterceptor,
    // Env-selected port provider (STORAGE_PORT pattern, users.module.ts): the real PayMongo
    // adapter in prod, an in-memory fake in tests so no network call ever happens there.
    { provide: PROVIDER_PORT, useClass: process.env.NODE_ENV === "test" ? FakeProviderAdapter : PaymongoAdapter },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
