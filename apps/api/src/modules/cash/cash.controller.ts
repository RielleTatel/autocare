import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { cashShiftCloseSchema, cashPaymentSchema, CashShiftClose, CashPaymentCreate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { Idempotent } from "../../common/idempotency/idempotent.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { CashService } from "./cash.service";

/**
 * Cash/COD counter flow (Task 7, FR-084..086). `POST /payments/cash` lives here (not in
 * `PaymentsModule`) to keep all cash-shift-aware payment logic together — Task 6's
 * `PaymentsModule` owns `/payments/intents` and `/webhooks/payments` (e-payment only).
 */
@Controller()
export class CashController {
  constructor(private cash: CashService) {}

  @Post("cash-shifts/open")
  openShift(@CurrentUser() u: AbilityUser) {
    return this.cash.openShift(u);
  }

  @Post("cash-shifts/:id/close")
  closeShift(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cashShiftCloseSchema)) dto: CashShiftClose,
  ) {
    return this.cash.closeShift(u, id, dto.countedCentavos);
  }

  @Post("payments/cash")
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  recordCashPayment(
    @CurrentUser() u: AbilityUser,
    @Body(new ZodValidationPipe(cashPaymentSchema)) dto: CashPaymentCreate,
  ) {
    return this.cash.recordCashPayment(u, dto);
  }

  @Get("admin/reports/remittance")
  remittance(@CurrentUser() u: AbilityUser, @Query("date") date: string) {
    return this.cash.remittanceReport(u, date);
  }
}
