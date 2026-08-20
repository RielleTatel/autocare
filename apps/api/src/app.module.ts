import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./modules/health/health.controller";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
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
    PoliciesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
