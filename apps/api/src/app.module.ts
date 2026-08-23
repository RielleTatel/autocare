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
import { BillingModule } from "./modules/billing/billing.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { ChecklistsModule } from "./modules/checklists/checklists.module";
import { SyncModule } from "./modules/sync/sync.module";
import { InspectionsModule } from "./modules/inspections/inspections.module";
import { CertificatesModule } from "./modules/certificates/certificates.module";
import { ClockModule } from "./common/clock/clock.module";
import { RedisModule } from "./common/redis/redis.module";
import { PoliciesModule } from "./common/policies/policies.module";
import { EnvelopeInterceptor } from "./common/interceptors/envelope.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AppThrottlerGuard } from "./common/throttler/throttler.guard";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    ClockModule,
    RedisModule,
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
    BillingModule,
    InvoicesModule,
    SchedulingModule,
    ChecklistsModule,
    SyncModule,
    InspectionsModule,
    CertificatesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
