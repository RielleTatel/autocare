import { Body, Controller, Get, Post, Redirect, UseInterceptors } from "@nestjs/common";
import { paymentIntentCreateSchema, PaymentIntentCreate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { Idempotent } from "../../common/idempotency/idempotent.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { PaymentsService } from "./payments.service";
import { Public } from "../auth/public.decorator";

@Controller("payments")
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Public()
  @Get("return")
  @Redirect("autocare://payment-result", 302)
  checkoutReturn() {
    return undefined;
  }

  @Post("intents")
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  createIntent(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(paymentIntentCreateSchema)) dto: PaymentIntentCreate) {
    return this.payments.createIntent(u, dto.invoiceId);
  }
}
