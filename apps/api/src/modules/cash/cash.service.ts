import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CashPaymentCreate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { InvoiceState, nextState, subscriptionStatusFor } from "../payments/invoice-lifecycle";
import { manilaDayRange } from "./manila-day";

/** Counter cash collection is done by ADVISOR staff (and ADMIN, who can do anything). */
const CASH_COLLECTOR_ROLES = ["ADVISOR", "ADMIN"];

/** CashShift's money columns are BigInt in Prisma — convert to Number for the wire (matches the rest of the codebase's convention, e.g. subscriptions.service.ts's toPlanSummary/toSubscriptionResponse). */
const toShiftResponse = (shift: {
  id: string; userId: string; openedAt: Date; closedAt: Date | null;
  expectedCentavos: bigint; countedCentavos: bigint | null; varianceCentavos: bigint | null;
}) => ({
  ...shift,
  expectedCentavos: Number(shift.expectedCentavos),
  countedCentavos: shift.countedCentavos === null ? null : Number(shift.countedCentavos),
  varianceCentavos: shift.varianceCentavos === null ? null : Number(shift.varianceCentavos),
});

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  private requireCashCollector(user: AbilityUser) {
    if (!CASH_COLLECTOR_ROLES.includes(user.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "Only counter staff (ADVISOR/ADMIN) can perform this action", 403);
    }
  }

  /** POST /cash-shifts/open — rejects double-open (Task 7 §cash-shifts/open). */
  async openShift(user: AbilityUser) {
    this.requireCashCollector(user);
    const open = await this.prisma.cashShift.findFirst({ where: { userId: user.id, closedAt: null } });
    if (open) {
      throw new DomainError("SHIFT_ALREADY_OPEN", "You already have an open cash shift — close it before opening another", 409);
    }
    const shift = await this.prisma.cashShift.create({ data: { userId: user.id } });
    return toShiftResponse(shift);
  }

  /**
   * POST /cash-shifts/:id/close — body `{ countedCentavos }`. Only the shift's owner or an
   * ADMIN may close it. `expectedCentavos` is computed at close time as
   * `SUM(payments.amountCentavos WHERE shiftId=... AND status=SUCCEEDED)` — simplest and
   * race-free vs. maintaining a running total incrementally on every cash payment (brief's
   * documented choice).
   */
  async closeShift(user: AbilityUser, shiftId: string, countedCentavos: number) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new DomainError("FORBIDDEN_ROLE", "Cash shift not found", 404);
    if (shift.userId !== user.id && user.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN_ROLE", "You cannot close another staff member's shift", 403);
    }
    if (shift.closedAt) {
      throw new DomainError("SHIFT_ALREADY_CLOSED", "This cash shift is already closed", 409);
    }

    const agg = await this.prisma.payment.aggregate({
      where: { shiftId, method: "CASH", status: "SUCCEEDED" },
      _sum: { amountCentavos: true },
    });
    const expected = agg._sum.amountCentavos ?? 0n;
    const counted = BigInt(countedCentavos);
    const variance = counted - expected;

    const closed = await this.prisma.cashShift.update({
      where: { id: shiftId },
      data: { closedAt: new Date(), expectedCentavos: expected, countedCentavos: counted, varianceCentavos: variance },
    });
    return toShiftResponse(closed);
  }

  /**
   * POST /payments/cash — requires an OPEN shift for the collecting staff, records a CASH
   * Payment against the invoice, and fires CASH_RECORDED (invoice -> PAID, subscription ->
   * ACTIVE) all in one transaction. `clientUuid` (unique on Payment) provides offline replay
   * safety independent of the `Idempotency-Key` header handled by `@Idempotent()`: a P2002 on
   * `clientUuid` here means "already recorded" and is treated as an idempotent success rather
   * than an error, returning the pre-existing payment/change.
   */
  async recordCashPayment(user: AbilityUser, dto: CashPaymentCreate) {
    this.requireCashCollector(user);

    const openShift = await this.prisma.cashShift.findFirst({ where: { userId: user.id, closedAt: null } });
    if (!openShift) {
      throw new DomainError("NO_OPEN_SHIFT", "You must open a cash shift before recording cash payments", 409);
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);

    const tendered = BigInt(dto.amountTendered);
    if (tendered < invoice.totalCentavos) {
      // Amount-tendered-too-low: a dedicated code (not PAYMENT_FAILED, which reads as a PSP/charge
      // failure) — 422 since the request is well-formed but the tendered amount is insufficient.
      throw new DomainError("CASH_TENDER_INSUFFICIENT", "Amount tendered is less than the invoice total", 422);
    }
    const changeCentavos = tendered - invoice.totalCentavos;

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        const nextInvoiceState: InvoiceState = nextState(invoice.status as InvoiceState, { type: "CASH_RECORDED" });

        const created = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            method: "CASH",
            amountCentavos: invoice.totalCentavos,
            status: "SUCCEEDED",
            collectedByUserId: user.id,
            shiftId: openShift.id,
            clientUuid: dto.clientUuid,
          },
        });

        await tx.invoice.update({ where: { id: invoice.id }, data: { status: nextInvoiceState } });

        if (invoice.subscriptionId) {
          await tx.subscription.update({
            where: { id: invoice.subscriptionId },
            data: { status: subscriptionStatusFor(nextInvoiceState) },
          });
        }

        return created;
      });

      return { paymentId: payment.id, changeCentavos: Number(changeCentavos) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existing = await this.prisma.payment.findUnique({ where: { clientUuid: dto.clientUuid } });
        if (existing) {
          return { paymentId: existing.id, changeCentavos: Number(changeCentavos) };
        }
      }
      throw e;
    }
  }

  /**
   * GET /admin/reports/remittance?date=YYYY-MM-DD — admin only. Per-staff totals for the
   * Manila calendar day: `systemTotalCentavos` sums CASH payments *collected* that day
   * (by `Payment.createdAt`); `countedCentavos`/`shiftCount` come from shifts *closed* that
   * day (by `CashShift.closedAt`). A staff member appears if either set has a row for them.
   */
  async remittanceReport(user: AbilityUser, date: string) {
    if (user.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN_ROLE", "Only admins may view the remittance report", 403);
    }
    const { start, end } = manilaDayRange(date);

    const [payments, shifts] = await Promise.all([
      this.prisma.payment.findMany({
        where: { method: "CASH", status: "SUCCEEDED", createdAt: { gte: start, lt: end } },
      }),
      this.prisma.cashShift.findMany({
        where: { closedAt: { gte: start, lt: end } },
      }),
    ]);

    type Row = { systemTotalCentavos: bigint; countedCentavos: bigint; shiftCount: number };
    const byStaff = new Map<string, Row>();
    const ensure = (id: string): Row => {
      let row = byStaff.get(id);
      if (!row) {
        row = { systemTotalCentavos: 0n, countedCentavos: 0n, shiftCount: 0 };
        byStaff.set(id, row);
      }
      return row;
    };

    for (const p of payments) {
      if (!p.collectedByUserId) continue;
      ensure(p.collectedByUserId).systemTotalCentavos += p.amountCentavos;
    }
    for (const s of shifts) {
      const row = ensure(s.userId);
      row.countedCentavos += s.countedCentavos ?? 0n;
      row.shiftCount += 1;
    }

    const staffIds = [...byStaff.keys()];
    const users = await this.prisma.user.findMany({ where: { id: { in: staffIds } } });
    const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email ?? u.mobile ?? u.id]));

    return staffIds.map((staffUserId) => {
      const row = byStaff.get(staffUserId)!;
      return {
        staffUserId,
        staffName: nameById.get(staffUserId) ?? staffUserId,
        systemTotalCentavos: Number(row.systemTotalCentavos),
        countedCentavos: Number(row.countedCentavos),
        varianceCentavos: Number(row.countedCentavos - row.systemTotalCentavos),
        shiftCount: row.shiftCount,
      };
    });
  }
}
