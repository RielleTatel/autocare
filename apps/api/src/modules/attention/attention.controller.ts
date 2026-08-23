import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { AttentionService } from "./attention.service";

@Controller()
export class AttentionController {
  constructor(private attention: AttentionService) {}

  /** FR-109 — one aggregated answer to "what needs attention?" across all the
   *  caller's vehicles. Empty array (not 404) when nothing is outstanding. */
  @Get("me/attention")
  mine(@CurrentUser() u: AbilityUser) {
    return this.attention.build(u.id);
  }
}
