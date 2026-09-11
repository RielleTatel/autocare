import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  baySchema, blockSchema, operatingHoursSchema, serviceTypeSchema, shiftSchema, shiftQuerySchema, shiftUpdateSchema,
  BayInput, BlockInput, OperatingHoursInput, ServiceTypeInput, ShiftInput, ShiftQuery, ShiftUpdate,
} from "@autocare/contracts";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { SchedulingConfigService } from "./scheduling-config.service";

const boardQuerySchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

@Controller("scheduling")
export class SchedulingConfigController {
  constructor(private config: SchedulingConfigService) {}

  @Get("service-types")
  listServiceTypes() {
    return this.config.listServiceTypes();
  }

  @Post("service-types")
  createServiceType(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(serviceTypeSchema)) dto: ServiceTypeInput) {
    return this.config.createServiceType(u, dto);
  }

  @Get("bays")
  listBays(@CurrentUser() u: AbilityUser) {
    return this.config.listBays(u);
  }

  @Post("bays")
  createBay(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(baySchema)) dto: BayInput) {
    return this.config.createBay(u, dto);
  }

  @Get("rosterable-staff")
  listRosterableStaff(@CurrentUser() u: AbilityUser) {
    return this.config.listRosterableStaff(u);
  }

  @Get("shifts")
  listShifts(@CurrentUser() u: AbilityUser, @Query(new ZodValidationPipe(shiftQuerySchema)) q: ShiftQuery) {
    return this.config.listShifts(u, q);
  }

  @Post("shifts")
  createShift(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(shiftSchema)) dto: ShiftInput) {
    return this.config.createShift(u, dto);
  }

  @Patch("shifts/:id")
  updateShift(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(shiftUpdateSchema)) dto: ShiftUpdate) {
    return this.config.updateShift(u, id, dto);
  }

  @Delete("shifts/:id")
  deleteShift(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.config.deleteShift(u, id);
  }

  @Post("blocks")
  createBlock(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(blockSchema)) dto: BlockInput) {
    return this.config.createBlock(u, dto);
  }

  @Get("operating-hours")
  listOperatingHours(@CurrentUser() u: AbilityUser) {
    return this.config.listOperatingHours(u);
  }

  @Put("operating-hours")
  upsertOperatingHours(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(operatingHoursSchema)) dto: OperatingHoursInput) {
    return this.config.upsertOperatingHours(u, dto);
  }

  @Get("board")
  board(@CurrentUser() u: AbilityUser, @Query(new ZodValidationPipe(boardQuerySchema)) q: { from: string; to: string }) {
    return this.config.board(u, q.from, q.to);
  }
}
