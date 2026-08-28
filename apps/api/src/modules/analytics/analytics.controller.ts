import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { AnalyticsService } from "./analytics.service";

@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get("summary")
  summary(@CurrentUser() u: AbilityUser) {
    return this.analytics.summary(u);
  }
}
