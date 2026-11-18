import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get() list(@CurrentUser() u: AbilityUser, @Query("scope", new ZodValidationPipe(z.enum(["workshop"]).optional())) scope?: "workshop") {
    return this.invoices.list(u, scope);
  }

  @Get(":id") get(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.invoices.get(u, id); }

  @Get(":id/pdf") pdf(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.invoices.pdfUrl(u, id); }
}
