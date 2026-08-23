import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { appointmentCreateSchema, rescheduleSchema, AppointmentCreate, Reschedule } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { AppointmentsService } from "./appointments.service";

@Controller("appointments")
export class AppointmentsController {
  constructor(private appointments: AppointmentsService) {}

  @Get()
  list(@CurrentUser() u: AbilityUser) {
    return this.appointments.listForUser(u);
  }

  @Post()
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(appointmentCreateSchema)) dto: AppointmentCreate) {
    return this.appointments.book(u, dto);
  }

  @Patch(":id/reschedule")
  reschedule(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rescheduleSchema)) dto: Reschedule,
  ) {
    return this.appointments.reschedule(u, id, dto);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.appointments.cancel(u, id);
  }
}
