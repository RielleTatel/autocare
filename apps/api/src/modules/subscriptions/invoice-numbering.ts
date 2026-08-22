import { Prisma } from "@prisma/client";

/**
 * Invoice numbering (Task 4 decision): `INV-<year>-<6-digit counter>`, counter = count of
 * invoices already issued this year + 1. Because two concurrent writers can both read the same
 * count before either commits, a collision surfaces as a Postgres unique-constraint violation
 * (P2002) on `Invoice.number` — `withInvoiceNumberRetry` catches that and retries the whole
 * creation with a freshly-read count. This is correct but not lock-free; if invoice-creation
 * throughput ever becomes a bottleneck, swap for a Postgres `SEQUENCE`.
 *
 * Shared by SubscriptionsService (Task 4 — creation/upgrade/cancellation invoices) and
 * BillingService (Task 8 — renewal invoices from `billing.issueInvoices`) so both paths draw
 * from the same yearly counter and retry scheme instead of drifting.
 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await tx.invoice.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export async function withInvoiceNumberRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const isCollision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isCollision || i === attempts - 1) throw e;
    }
  }
  /* istanbul ignore next — unreachable: loop always returns or throws */
  throw new Error("unreachable");
}
