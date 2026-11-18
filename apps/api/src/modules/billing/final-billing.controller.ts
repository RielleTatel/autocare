import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { finalBillingIssueSchema, finalBillingReturnSchema, FinalBillingIssueInput, FinalBillingReturnInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CurrentUser } from "../auth/current-user.decorator";
import { FinalBillingService } from "./final-billing.service";

@Controller("admin/final-billing/reviews")
export class FinalBillingController {
  constructor(private finalBilling: FinalBillingService) {}

  @Get()
  list(@CurrentUser() user: AbilityUser) {
    return this.finalBilling.listReviews(user);
  }

  @Get(":appointmentId")
  get(@CurrentUser() user: AbilityUser, @Param("appointmentId") appointmentId: string) {
    return this.finalBilling.getReview(user, appointmentId);
  }

  @Post(":appointmentId/return")
  returnForCorrection(@CurrentUser() user: AbilityUser, @Param("appointmentId") appointmentId: string,
                      @Body(new ZodValidationPipe(finalBillingReturnSchema)) dto: FinalBillingReturnInput) {
    return this.finalBilling.returnForCorrection(user, appointmentId, dto);
  }

  @Post(":appointmentId/issue")
  issue(@CurrentUser() user: AbilityUser, @Param("appointmentId") appointmentId: string,
        @Body(new ZodValidationPipe(finalBillingIssueSchema)) dto: FinalBillingIssueInput) {
    return this.finalBilling.issue(user, appointmentId, dto);
  }
}
