import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { inspectionPhotoAttachSchema, inspectionPhotoReadSchema, InspectionPhotoAttachInput, InspectionPhotoReadInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { InspectionsService } from "./inspections.service";

@Controller()
export class InspectionsController {
  constructor(private inspections: InspectionsService) {}

  @Get("vehicles/:vehicleId/health-score")
  healthScore(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string) {
    return this.inspections.healthScore(u, vehicleId);
  }

  @Get("vehicles/:vehicleId/health-score/history")
  history(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string) {
    return this.inspections.history(u, vehicleId);
  }

  @Get("vehicles/:vehicleId/inspections")
  list(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string) {
    return this.inspections.listInspections(u, vehicleId);
  }

  @Get("vehicles/:vehicleId/inspections/:inspectionId")
  detail(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string, @Param("inspectionId") inspectionId: string) {
    return this.inspections.inspectionDetail(u, vehicleId, inspectionId);
  }

  @Post("inspections/:inspectionClientUuid/photos")
  attachPhoto(@CurrentUser() u: AbilityUser, @Param("inspectionClientUuid") inspectionClientUuid: string,
              @Body(new ZodValidationPipe(inspectionPhotoAttachSchema)) dto: InspectionPhotoAttachInput) {
    return this.inspections.attachPhoto(u, inspectionClientUuid, dto);
  }

  @Post("inspections/:inspectionClientUuid/photos/signed-read-url")
  signedPhotoRead(@CurrentUser() u: AbilityUser, @Param("inspectionClientUuid") inspectionClientUuid: string,
                  @Body(new ZodValidationPipe(inspectionPhotoReadSchema)) dto: InspectionPhotoReadInput) {
    return this.inspections.signedPhotoRead(u, inspectionClientUuid, dto);
  }
}
