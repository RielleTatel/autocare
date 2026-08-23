import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { InspectionsService } from "./inspections.service";

@Controller("vehicles/:vehicleId")
export class InspectionsController {
  constructor(private inspections: InspectionsService) {}

  @Get("health-score")
  healthScore(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string) {
    return this.inspections.healthScore(u, vehicleId);
  }

  @Get("health-score/history")
  history(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string) {
    return this.inspections.history(u, vehicleId);
  }

  @Get("inspections/:inspectionId")
  detail(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string, @Param("inspectionId") inspectionId: string) {
    return this.inspections.inspectionDetail(u, vehicleId, inspectionId);
  }
}
