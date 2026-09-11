import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { roadsideRequestSchema, type RoadsideRequestInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { RoadsideService } from "./roadside.service";

@Controller("roadside")
export class RoadsideController {
  constructor(private roadside: RoadsideService) {}

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
