import { Global, Module } from "@nestjs/common";
import { CLOCK, SystemClock } from "./clock";

/**
 * Global so any module can `@Inject(CLOCK)` without importing this module explicitly (Prisma's
 * PrismaModule follows the same pattern). Tests override the CLOCK provider via
 * `overrideProvider(CLOCK).useValue(fakeClock)` to drive a deterministic timeline.
 */
@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
