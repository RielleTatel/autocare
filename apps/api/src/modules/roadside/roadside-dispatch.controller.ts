import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  roadsideDispatchSchema,
  roadsideResolveSchema,
  roadsideStatusSchema,
  type RoadsideDispatchInput,
  type RoadsideResolveInput,
  type RoadsideStatusInput,
} from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { RoadsideService } from "./roadside.service";

@Controller("roadside")
export class RoadsideDispatchController {
  constructor(private roadside: RoadsideService) {}

  @Get("board")
  board(@CurrentUser() u: AbilityUser) {
    return this.roadside.board(u);
  }

  /** FR-037 — the drivers this advisor may assign. */
  @Get("responders")
  responders(@CurrentUser() u: AbilityUser) {
    return this.roadside.responders(u);
  }

  @Post("requests/:id/dispatch")
  dispatch(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideDispatchSchema)) dto: RoadsideDispatchInput,
  ) {
    return this.roadside.dispatch(u, id, dto);
  }

  @Patch("requests/:id/status")
  setStatus(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideStatusSchema)) dto: RoadsideStatusInput,
  ) {
    return this.roadside.setStatus(u, id, dto);
  }

  @Post("requests/:id/resolve")
  resolve(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideResolveSchema)) dto: RoadsideResolveInput,
  ) {
    return this.roadside.resolve(u, id, dto);
  }
}
