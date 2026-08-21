import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./modules/health/health.controller";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { PlansModule } from "./modules/plans/plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CashModule } from "./modules/cash/cash.module";
import { PoliciesModule } from "./common/policies/policies.module";
import { EnvelopeInterceptor } from "./common/interceptors/envelope.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AppThrottlerGuard } from "./common/throttler/throttler.guard";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    UploadsModule,
    PlansModule,
    SubscriptionsModule,
    EntitlementsModule,
    PoliciesModule,
    PaymentsModule,
    CashModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
