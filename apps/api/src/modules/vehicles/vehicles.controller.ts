import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { odometerCreateSchema, vehicleCreateSchema, vehicleUpdateSchema,
         OdometerCreate, VehicleCreate, VehicleUpdate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "./vehicles.service";

@Controller("vehicles")
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Get() list(@CurrentUser() u: AbilityUser) { return this.vehicles.list(u); }

  @Post()
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(vehicleCreateSchema)) dto: VehicleCreate) {
    return this.vehicles.create(u, dto);
  }

  @Get(":id") get(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.vehicles.get(u, id); }

  @Patch(":id")
  update(@CurrentUser() u: AbilityUser, @Param("id") id: string,
         @Body(new ZodValidationPipe(vehicleUpdateSchema)) dto: VehicleUpdate) {
    return this.vehicles.update(u, id, dto);
  }

  @Delete(":id") archive(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.vehicles.archive(u, id); }

  @Post(":id/odometer")
  odometer(@CurrentUser() u: AbilityUser, @Param("id") id: string,
           @Body(new ZodValidationPipe(odometerCreateSchema)) dto: OdometerCreate) {
    return this.vehicles.recordOdometer(u, id, dto);
  }
}
