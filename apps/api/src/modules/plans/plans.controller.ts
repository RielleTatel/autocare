import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { planCreateSchema, planUpdateSchema, PlanCreate, PlanUpdate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CheckPolicy } from "../../common/policies/check-policy.decorator";
import { Public } from "../auth/public.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { PlansService } from "./plans.service";

@Controller()
export class PlansController {
  constructor(private plans: PlansService) {}

  @Public()
  @Get("plans")
  list() {
    return this.plans.listActive();
  }

  @Get("admin/plans")
  @CheckPolicy((a) => a.can("manage", "Plan"))
  listAll() {
    return this.plans.listAll();
  }

  @Post("admin/plans")
  @CheckPolicy((a) => a.can("manage", "Plan"))
  create(@CurrentUser() u: { id: string }, @Body(new ZodValidationPipe(planCreateSchema)) dto: PlanCreate) {
    return this.plans.create(u.id, dto);
  }

  @Patch("admin/plans/:id")
  @CheckPolicy((a) => a.can("manage", "Plan"))
  update(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(planUpdateSchema)) dto: PlanUpdate,
  ) {
    return this.plans.update(u.id, id, dto);
  }
}
