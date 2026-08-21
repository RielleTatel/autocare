import { Module } from "@nestjs/common";
import { CashController } from "./cash.controller";
import { CashService } from "./cash.service";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";

@Module({
  controllers: [CashController],
  providers: [CashService, IdempotencyInterceptor],
  exports: [CashService],
})
export class CashModule {}
