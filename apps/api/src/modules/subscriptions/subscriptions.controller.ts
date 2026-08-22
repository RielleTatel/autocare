import { Body, Controller, Get, Param, Post, UseInterceptors } from "@nestjs/common";
import {
  subscriptionCreateSchema, subscriptionUpgradeSchema, subscriptionDowngradeSchema, subscriptionCancelSchema,
  SubscriptionCreate, SubscriptionUpgrade, SubscriptionDowngrade, SubscriptionCancel,
} from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { Idempotent } from "../../common/idempotency/idempotent.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}

  @Post()
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(subscriptionCreateSchema)) dto: SubscriptionCreate) {
    return this.subscriptions.create(u, dto);
  }

  @Get() list(@CurrentUser() u: AbilityUser) { return this.subscriptions.list(u); }

  @Get(":id") get(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.subscriptions.get(u, id); }

  @Get(":id/entitlements")
  entitlements(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.subscriptions.entitlements(u, id); }

  @Post(":id/upgrade")
  upgrade(@CurrentUser() u: AbilityUser, @Param("id") id: string,
          @Body(new ZodValidationPipe(subscriptionUpgradeSchema)) dto: SubscriptionUpgrade) {
    return this.subscriptions.upgrade(u, id, dto);
  }

  @Post(":id/downgrade")
  downgrade(@CurrentUser() u: AbilityUser, @Param("id") id: string,
            @Body(new ZodValidationPipe(subscriptionDowngradeSchema)) dto: SubscriptionDowngrade) {
    return this.subscriptions.downgrade(u, id, dto);
  }

  @Get(":id/cancellation-quote")
  cancellationQuote(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.subscriptions.cancellationQuote(u, id); }

  @Post(":id/cancel")
  cancel(@CurrentUser() u: AbilityUser, @Param("id") id: string,
         @Body(new ZodValidationPipe(subscriptionCancelSchema)) dto: SubscriptionCancel) {
    return this.subscriptions.cancel(u, id, dto);
  }
}
