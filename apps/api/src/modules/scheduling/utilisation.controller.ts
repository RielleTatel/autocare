import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { UtilisationService } from "./utilisation.service";

const parseWindowDays = (raw?: string): number => {
  const n = raw ? parseInt(raw.replace(/d$/, ""), 10) : 14;
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : 14;
};

@Controller("admin/capacity")
export class UtilisationController {
  constructor(private utilisation: UtilisationService) {}

  @Get("utilisation")
  utilisationWindow(@CurrentUser() u: AbilityUser, @Query("window") window?: string) {
    return this.utilisation.forWindowForUser(u, parseWindowDays(window));
  }
}
