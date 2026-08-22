import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { renderInvoicePdf } from "./invoice-pdf";

const INVOICE_SELECT = {
  id: true, number: true, subscriptionId: true, totalCentavos: true, status: true,
  dueDate: true, issuedAt: true, pdfObjectPath: true,
  items: { select: { id: true, description: true, qty: true, unitPriceCentavos: true, taxCentavos: true } },
  subscription: { select: { id: true, vehicleId: true, paymentMethod: true, plan: { select: { name: true, billingInterval: true } } } },
  payments: { select: { method: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
} as const;

type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof INVOICE_SELECT }>;

const toInvoiceResponse = (row: InvoiceRow) => ({
  id: row.id,
  number: row.number,
  subscriptionId: row.subscriptionId,
  totalCentavos: Number(row.totalCentavos),
  status: row.status,
  dueDate: row.dueDate.toISOString(),
  issuedAt: row.issuedAt.toISOString(),
  items: row.items.map((i) => ({
    id: i.id, description: i.description, qty: i.qty,
    unitPriceCentavos: Number(i.unitPriceCentavos), taxCentavos: Number(i.taxCentavos),
  })),
});

// PDF download expiry: short-lived enough that a shared/leaked link goes stale quickly, long
// enough for a mobile client to actually open the share sheet / hand it to another app.
const PDF_DOWNLOAD_EXPIRY_SECONDS = 15 * 60;

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private vehicles: VehiclesService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {}

  /**
   * Ownership-checked load — a member owns an invoice via its subscription's vehicle owner
   * (mirrors SubscriptionsService.findForUser); ADMIN/staff read via VehiclesService's CASL
   * "read" ability, which already grants MECHANIC/ADVISOR/DRIVER unconditional read and ADMIN
   * "manage all". Invoices with no subscription (e.g. future work-order invoices) are
   * ADMIN-only for now — there is no vehicle to check ownership against.
   */
  private async findForUser(user: AbilityUser, id: string): Promise<InvoiceRow> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, select: INVOICE_SELECT });
    if (!invoice) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);
    if (invoice.subscription) {
      await this.vehicles.findForUser(user, invoice.subscription.vehicleId, "read");
    } else if (user.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN_ROLE", "You cannot access this invoice", 403);
    }
    return invoice;
  }

  async list(user: AbilityUser) {
    if (user.role === "FLEET_MANAGER" && !user.orgId) return [];
    const vehicleOwner = user.role === "FLEET_MANAGER" ? { orgOwnerId: user.orgId } : { ownerUserId: user.id };
    const rows = await this.prisma.invoice.findMany({
      where: { subscription: { vehicle: vehicleOwner } },
      select: INVOICE_SELECT,
      orderBy: { issuedAt: "desc" },
    });
    return rows.map(toInvoiceResponse);
  }

  async get(user: AbilityUser, id: string) {
    const row = await this.findForUser(user, id);
    return toInvoiceResponse(row);
  }

  /**
   * Renders (if not already rendered) and returns a signed download URL for the invoice's PDF
   * receipt. Generation choice (documented per brief): SYNCHRONOUS — these are small, single-page
   * text receipts (no images/fonts to fetch), so rendering inline is fast and keeps the endpoint
   * a simple request/response instead of an enqueue-then-poll dance. `invoices.generatePdf`
   * (invoices.pdf.processor.ts) implements the same render via `renderAndStore` for callers that
   * want it queued (e.g. a future "email the receipt" job) — both paths share this one method so
   * there is exactly one place that renders + persists the object path.
   */
  async pdfUrl(user: AbilityUser, id: string): Promise<{ url: string }> {
    const row = await this.findForUser(user, id);
    const objectPath = row.pdfObjectPath ?? (await this.renderAndStore(row));
    const url = await this.storage.createDownloadUrl(objectPath, PDF_DOWNLOAD_EXPIRY_SECONDS);
    return { url };
  }

  /** Renders the PDF for an already-loaded invoice row, stores it, and persists the object path. Reused by pdfUrl() and the BullMQ processor. */
  async renderAndStore(row: InvoiceRow): Promise<string> {
    const buffer = await renderInvoicePdf(
      {
        id: row.id, number: row.number, totalCentavos: Number(row.totalCentavos),
        status: row.status, issuedAt: row.issuedAt, dueDate: row.dueDate,
      },
      row.items.map((i) => ({
        description: i.description, qty: i.qty,
        unitPriceCentavos: Number(i.unitPriceCentavos), taxCentavos: Number(i.taxCentavos),
      })),
      row.payments[0] ? { method: row.payments[0].method, status: row.payments[0].status } : undefined,
      row.subscription ? { id: row.subscription.id, paymentMethod: row.subscription.paymentMethod } : undefined,
      row.subscription?.plan ?? undefined,
    );
    const objectPath = `invoices/${row.id}/${row.number}.pdf`;
    await this.storage.putObject(objectPath, buffer, "application/pdf");
    await this.prisma.invoice.update({ where: { id: row.id }, data: { pdfObjectPath: objectPath } });
    return objectPath;
  }

  /** Loads an invoice by id (no ownership check — used by the BullMQ processor, which runs as a trusted background worker). */
  async loadForRender(invoiceId: string): Promise<InvoiceRow> {
    return this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: INVOICE_SELECT });
  }
}
