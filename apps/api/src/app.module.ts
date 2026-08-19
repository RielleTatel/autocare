import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./modules/health/health.controller";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { EnvelopeInterceptor } from "./common/interceptors/envelope.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
