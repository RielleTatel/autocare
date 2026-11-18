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

  /** GET /cash-shifts/current — only the authenticated collector's own open shift. */
  async currentShift(user: AbilityUser) {
    this.requireCashCollector(user);
    const shift = await this.prisma.cashShift.findFirst({ where: { userId: user.id, closedAt: null } });
    return shift ? toShiftResponse(shift) : null;
  }

  /** POST /cash-shifts/open — rejects double-open (Task 7 §cash-shifts/open). */
  async openShift(user: AbilityUser) {
    this.requireCashCollector(user);
    const shift = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`);
      const open = await tx.cashShift.findFirst({ where: { userId: user.id, closedAt: null } });
      if (open) {
        throw new DomainError("SHIFT_ALREADY_OPEN", "You already have an open cash shift — close it before opening another", 409);
      }
      return tx.cashShift.create({ data: { userId: user.id } });
    });
    return toShiftResponse(shift);
  }

  /**
   * POST /cash-shifts/:id/close — body `{ countedCentavos }`. Only the shift's owner or an
   * ADMIN may close it. `expectedCentavos` is computed at close time as
   * `SUM(payments.amountCentavos WHERE shiftId=... AND status=SUCCEEDED)` — simplest and
   * reconciled while holding the same shift row lock as cash collection.
   */
  async closeShift(user: AbilityUser, shiftId: string, countedCentavos: number) {
    this.requireCashCollector(user);
    if (!Number.isSafeInteger(countedCentavos) || countedCentavos < 0) {
      throw new DomainError("PAYMENT_FAILED", "Cash counted must be a nonnegative whole-centavo amount within the supported range", 422);
    }
    const closed = await this.prisma.$transaction(async tx => {
      const shift = await this.lockShift(tx, shiftId);
      if (!shift) throw new DomainError("FORBIDDEN_ROLE", "Cash shift not found", 404);
      if (shift.userId !== user.id && user.role !== "ADMIN") {
        throw new DomainError("FORBIDDEN_ROLE", "You cannot close another staff member's shift", 403);
      }
      if (shift.closedAt) {
        throw new DomainError("SHIFT_ALREADY_CLOSED", "This cash shift is already closed", 409);
      }

      const agg = await tx.payment.aggregate({
        where: { shiftId, method: "CASH", status: "SUCCEEDED" },
        _sum: { amountCentavos: true },
      });
      const expected = agg._sum.amountCentavos ?? 0n;
      const counted = BigInt(countedCentavos);
      return tx.cashShift.update({
        where: { id: shiftId },
        data: { closedAt: new Date(), expectedCentavos: expected, countedCentavos: counted, varianceCentavos: counted - expected },
      });
    });
    return toShiftResponse(closed);
  }

  /**
   * POST /payments/cash — requires an OPEN shift for the collecting staff, records a CASH
   * Payment against the invoice, and fires CASH_RECORDED (invoice -> PAID, subscription ->
   * ACTIVE) all in one transaction. `clientUuid` (unique on Payment) provides retry
   * safety independent of the `Idempotency-Key` header handled by `@Idempotent()`: a P2002 on
   * `clientUuid` here means "already recorded" and is treated as an idempotent success rather
   * than an error, returning the original recorded change. Only the original collector,
   * invoice and tender may replay that identity.
   *
   * Double-settle / race guard (code-review fix): the invoice is re-read INSIDE the
   * transaction and advanced via a conditional `updateMany({ where: { id, status: <the value
   * just read> } })` rather than an unconditional `update`. If a concurrent request already
   * flipped the invoice's status (or it was already PAID/non-cash-payable before this request
   * even started), `nextState` is a no-op or the conditional update's affected count is 0 —
   * either way we throw `INVOICE_ALREADY_PAID` and roll back instead of silently creating a
   * second full-amount Payment against an already-settled invoice.
   */
  async recordCashPayment(user: AbilityUser, dto: CashPaymentCreate) {
    this.requireCashCollector(user);
    if (!Number.isSafeInteger(dto.amountTendered) || dto.amountTendered < 0) {
      throw new DomainError("PAYMENT_FAILED", "Cash tendered must be a nonnegative whole-centavo amount within the supported range", 422);
    }

    // Up-front clientUuid replay check (sequential offline retry — the common case): without
    // this, a retry that reaches here AFTER the first request already advanced the invoice to
    // PAID would hit the INVOICE_ALREADY_PAID guard below instead of being recognized as "this
    // exact payment was already recorded". The P2002 catch further down remains as a race-safety
    // net for the rarer case of two truly concurrent requests sharing the same clientUuid.
    const preExisting = await this.prisma.payment.findUnique({ where: { clientUuid: dto.clientUuid } });
    if (preExisting) {
      return this.replayCashPayment(user, dto, preExisting);
    }

    // A successful replay is a read of the original collection, even after its
    // shift closes. Every new collection still requires the collector's open shift.
    const openShift = await this.prisma.cashShift.findFirst({ where: { userId: user.id, closedAt: null } });
    if (!openShift) {
      throw new DomainError("NO_OPEN_SHIFT", "You must open a cash shift before recording cash payments", 409);
    }

    const tendered = BigInt(dto.amountTendered);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const shift = await this.lockShift(tx, openShift.id);
        if (!shift || shift.userId !== user.id || shift.closedAt) {
          throw new DomainError("NO_OPEN_SHIFT", "Your cash shift is closed; open a shift before recording a new payment", 409);
        }
        const invoice = await tx.invoice.findUnique({ where: { id: dto.invoiceId } });
        if (!invoice) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);
        if (invoice.documentKind === "NO_CHARGE" || invoice.totalCentavos <= 0n) {
          throw new DomainError("INVOICE_ALREADY_PAID", "No cash payment is due for this document", 409);
        }

        if (tendered < invoice.totalCentavos) {
          // Amount-tendered-too-low: a dedicated code (not PAYMENT_FAILED, which reads as a
          // PSP/charge failure) — 422 since the request is well-formed but the tendered
          // amount is insufficient.
          throw new DomainError("CASH_TENDER_INSUFFICIENT", "Amount tendered is less than the invoice total", 422);
        }

        const nextInvoiceState: InvoiceState = nextState(invoice.status as InvoiceState, { type: "CASH_RECORDED" });
        if (nextInvoiceState === invoice.status) {
          // CASH_RECORDED didn't move this invoice at all — it's already PAID (or in a state
          // cash payments can't advance, e.g. an e-payment-only invoice). Either way, no
          // payment gets created.
          throw new DomainError("INVOICE_ALREADY_PAID", "This invoice is already settled", 409);
        }

        // Conditional update — the concurrency guard: only the transaction that still sees
        // the invoice at its pre-read status can flip it. A concurrent winner already moved
        // it, so the loser's affected count is 0 here even though its own pre-read looked
        // payable.
        const advanced = await tx.invoice.updateMany({
          where: { id: invoice.id, status: invoice.status },
          data: { status: nextInvoiceState, pdfObjectPath: null },
        });
        if (advanced.count === 0) {
          throw new DomainError("INVOICE_ALREADY_PAID", "This invoice is already settled", 409);
        }

        const created = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            method: "CASH",
            amountCentavos: invoice.totalCentavos,
            cashTenderedCentavos: tendered,
            changeCentavos: tendered - invoice.totalCentavos,
            status: "SUCCEEDED",
            collectedByUserId: user.id,
            shiftId: openShift.id,
            clientUuid: dto.clientUuid,
          },
        });

        if (invoice.subscriptionId) {
          await tx.subscription.update({
            where: { id: invoice.subscriptionId },
            data: { status: subscriptionStatusFor(nextInvoiceState) },
          });
        }

        return { paymentId: created.id, changeCentavos: Number(tendered - invoice.totalCentavos) };
      });

      return result;
    } catch (e) {
      if ((e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") ||
          (e instanceof DomainError && e.code === "INVOICE_ALREADY_PAID")) {
        // A concurrent request may win the invoice-state guard before this request
        // reaches payment creation. Resolve the exact UUID after that transaction commits.
        const existing = await this.prisma.payment.findUnique({ where: { clientUuid: dto.clientUuid } });
        if (existing) {
          return this.replayCashPayment(user, dto, existing);
        }
      }
      throw e;
    }
  }

  private async lockShift(tx: Prisma.TransactionClient, shiftId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM cash_shifts WHERE id = ${shiftId}::uuid FOR UPDATE`);
    return tx.cashShift.findUnique({ where: { id: shiftId } });
  }

  private replayCashPayment(user: AbilityUser, dto: CashPaymentCreate, payment: {
    id: string; invoiceId: string; method: string; status: string; collectedByUserId: string | null;
    cashTenderedCentavos: bigint | null; changeCentavos: bigint | null;
  }) {
    if (payment.invoiceId !== dto.invoiceId || payment.collectedByUserId !== user.id ||
        payment.method !== "CASH" || payment.status !== "SUCCEEDED" ||
        (payment.cashTenderedCentavos != null && payment.cashTenderedCentavos !== BigInt(dto.amountTendered))) {
      throw new DomainError("DUPLICATE_REQUEST", "This cash operation identity belongs to a different collection", 409);
    }
    // Older cash rows did not persist tender or change; do not invent them from
    // a later request. New collections always retain the exact original amounts.
    return { paymentId: payment.id, changeCentavos: Number(payment.changeCentavos ?? 0n) };
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
