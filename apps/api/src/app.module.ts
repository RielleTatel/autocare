import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./modules/health/health.controller";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { PoliciesModule } from "./common/policies/policies.module";
import { EnvelopeInterceptor } from "./common/interceptors/envelope.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PoliciesModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
