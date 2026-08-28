import { Controller, Get, Header, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { RawResponse } from "../../common/interceptors/raw-response.decorator";
import { WasteExportService } from "./waste-export.service";

@Controller("admin/waste")
export class WasteController {
  constructor(private waste: WasteExportService) {}

  @Get("summary")
  summary(@CurrentUser() u: AbilityUser, @Query("from") from: string, @Query("to") to: string) {
    return this.waste.summary(u, from, to);
  }

  /** The body IS the document here, so it opts out of the success envelope. */
  @Get("export")
  @RawResponse()
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="autocare-waste-export.csv"')
  export(@CurrentUser() u: AbilityUser, @Query("from") from: string, @Query("to") to: string) {
    return this.waste.exportCsv(u, from, to);
  }
}
