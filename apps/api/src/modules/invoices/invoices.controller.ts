import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get() list(@CurrentUser() u: AbilityUser) { return this.invoices.list(u); }

  @Get(":id") get(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.invoices.get(u, id); }

  @Get(":id/pdf") pdf(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.invoices.pdfUrl(u, id); }
}
