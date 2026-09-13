import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { roadsideEligibilityConfigUpdateSchema, roadsideRequestSchema, type RoadsideEligibilityConfigUpdate, type RoadsideRequestInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { RoadsideService } from "./roadside.service";
import { RoadsideConfigService } from "./roadside-config.service";
import { CheckPolicy } from "../../common/policies/check-policy.decorator";

@Controller("roadside")
export class RoadsideController {
  constructor(private roadside: RoadsideService, private config: RoadsideConfigService) {}

  @Get("admin/config")
  @CheckPolicy((a) => a.can("update", "User"))
  adminConfig() {
    return this.config.get();
  }

  @Patch("admin/config")
  @CheckPolicy((a) => a.can("update", "User"))
  updateAdminConfig(
    @CurrentUser() u: AbilityUser,
    @Body(new ZodValidationPipe(roadsideEligibilityConfigUpdateSchema)) dto: RoadsideEligibilityConfigUpdate,
  ) {
    return this.config.set(u, dto);
  }

  /** FR-034 — the app asks before showing the button, so the refusal is calm. */
  @Get("eligibility")
  eligibility(@CurrentUser() u: AbilityUser) {
    return this.roadside.eligibility(u.id);
  }

  @Post("requests")
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(roadsideRequestSchema)) dto: RoadsideRequestInput) {
    return this.roadside.create(u.id, dto);
  }

  /** Drives M-27 and the Home card's live state. Null when nothing is open. */
  @Get("requests/active")
  active(@CurrentUser() u: AbilityUser) {
    return this.roadside.active(u.id);
  }

  @Get("requests/:id")
  byId(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.roadside.byId(u.id, id);
  }
}
