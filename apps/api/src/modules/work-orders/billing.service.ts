import { Injectable } from "@nestjs/common";
import { nextInvoiceNumber, withInvoiceNumberRetry } from "../subscriptions/invoice-numbering";
import { PrismaService } from "../prisma/prisma.service";

const DUE_DAYS = 7;

/** Issues an Invoice{workOrderId} on closure when there is a billable balance
 *  (approved parts + labour, net of line discounts). One invoice per work order:
 *  idempotent, so a re-close or retry never double-bills. */
@Injectable()
export class WorkOrderBillingService {
  constructor(private prisma: PrismaService) {}

  async issueForClosedWorkOrder(workOrderId: string): Promise<{ invoiceId: string; totalCentavos: number } | null> {
    const existing = await this.prisma.invoice.findFirst({ where: { workOrderId } });
    if (existing) return { invoiceId: existing.id, totalCentavos: Number(existing.totalCentavos) };

    const wo = await this.prisma.workOrder.findUnique({ where: { id: workOrderId }, include: { items: true } });
    if (!wo || wo.status !== "CLOSED") return null;

    const approved = wo.items.filter((i) => i.approvalStatus === "APPROVED");
    const lineTotal = (i: (typeof approved)[number]) => Math.max(0, i.qty * Number(i.unitPriceCentavos) - Number(i.discountCentavos));
    const total = approved.reduce((s, i) => s + lineTotal(i), 0);
    if (total <= 0) return null; // nothing billable (all declined, or entitlement-covered)

    const invoice = await withInvoiceNumberRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const number = await nextInvoiceNumber(tx);
        return tx.invoice.create({
          data: {
            workOrderId,
            number,
            totalCentavos: BigInt(total),
            status: "AWAITING_CASH", // settled at counter (W-13) or via e-payment intent (M-31)
            dueDate: new Date(Date.now() + DUE_DAYS * 86_400_000),
            // One invoice line per approved WO item, priced at its net line total
            // (after discount) as a qty-1 entry so the invoice sum matches exactly.
            items: {
              create: approved.map((i) => ({
                description: i.qty > 1 ? `${i.description} (x${i.qty})` : i.description,
                qty: 1,
                unitPriceCentavos: BigInt(lineTotal(i)),
              })),
            },
          },
        });
      }),
    );
    return { invoiceId: invoice.id, totalCentavos: total };
  }
}
