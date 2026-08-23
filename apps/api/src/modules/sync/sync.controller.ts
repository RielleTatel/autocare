import { Body, Controller, Get, Post } from "@nestjs/common";
import { syncBatchSchema, SyncBatchInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private sync: SyncService) {}

  @Post("batch")
  batch(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(syncBatchSchema)) dto: SyncBatchInput) {
    return this.sync.batch(u, dto);
  }

  @Get("status")
  status(@CurrentUser() u: AbilityUser) {
    return this.sync.status(u);
  }
}
