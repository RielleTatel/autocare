import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { holdCreateSchema, slotQuerySchema, HoldCreate, SlotQuery } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { SchedulingService } from "./scheduling.service";
import { HoldsService } from "./holds.service";

@Controller("scheduling")
export class SchedulingController {
  constructor(
    private scheduling: SchedulingService,
    private holds: HoldsService,
  ) {}

  @Get("slots")
  slots(@Query(new ZodValidationPipe(slotQuerySchema)) q: SlotQuery) {
    return this.scheduling.slots(q);
  }

  @Post("holds")
  hold(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(holdCreateSchema)) b: HoldCreate) {
    return this.holds.acquire(b.bayId, b.start, b.serviceTypeId, u.id);
  }

  @Delete("holds/:id")
  release(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.holds.release(decodeURIComponent(id), u.id);
  }
}
