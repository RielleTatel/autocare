import { Body, Controller, Ip, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { consentSchema } from "@autocare/contracts";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("auth")
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class ConsentController {
  constructor(private prisma: PrismaService) {}
  @Post("consent")
  async consent(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(consentSchema)) body: z.infer<typeof consentSchema>,
    @Ip() ip: string,
  ) {
    const rec = await this.prisma.consentRecord.create({
      data: { userId: user.id, policyVersion: body.policyVersion, ip },
    });
    return { consentedAt: rec.consentedAt.toISOString() };
  }
}
