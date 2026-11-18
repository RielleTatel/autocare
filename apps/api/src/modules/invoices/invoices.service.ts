import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { renderInvoicePdf } from "./invoice-pdf";
import { checkoutEligible, hasCheckoutOrigin, MEMBER_CHECKOUT_ORIGIN } from "../payments/checkout-policy";

const APPOINTMENT_SELECT = {
  id: true, vehicleId: true, serviceNameSnapshot: true,
  vehicle: { select: { plateNo: true } }, serviceType: { select: { name: true } },
} as const;

const INVOICE_SELECT = {
  id: true, number: true, subscriptionId: true, workOrderId: true, appointmentId: true,
  documentKind: true, totalCentavos: true, status: true,
  dueDate: true, issuedAt: true, pdfObjectPath: true,
  items: { select: { id: true, description: true, qty: true, unitPriceCentavos: true, taxCentavos: true, source: true } },
  subscription: { select: {
    id: true, vehicleId: true, status: true, paymentMethod: true,
    vehicle: { select: { plateNo: true } }, plan: { select: { name: true, billingInterval: true } },
  } },
  appointment: { select: APPOINTMENT_SELECT },
  workOrder: { select: { id: true, vehicleId: true, appointmentId: true, vehicle: { select: { plateNo: true } } } },
  payments: {
    where: { status: "SUCCEEDED" },
    select: { id: true, method: true, status: true, amountCentavos: true, cashTenderedCentavos: true, changeCentavos: true },
    orderBy: { createdAt: "desc" }, take: 1,
  },
} as const;

type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof INVOICE_SELECT }>;

const toInvoiceResponse = (row: InvoiceRow, hasOrigin = false) => ({
  checkoutEligible: row.documentKind !== "NO_CHARGE" && !row.appointmentId && checkoutEligible(row, hasOrigin),
  id: row.id,
  number: row.number,
  subscriptionId: row.subscriptionId,
  appointmentId: row.appointmentId ?? row.workOrder?.appointmentId ?? null,
  workOrderId: row.workOrderId,
  vehicleId: row.subscription?.vehicleId ?? row.appointment?.vehicleId ?? row.workOrder?.vehicleId ?? null,
  plateNo: row.subscription?.vehicle?.plateNo ?? row.appointment?.vehicle.plateNo ?? row.workOrder?.vehicle.plateNo ?? null,
  serviceName: row.appointment?.serviceNameSnapshot ?? row.appointment?.serviceType.name ?? null,
  documentKind: row.documentKind,
  totalCentavos: Number(row.totalCentavos),
  status: row.status,
  dueDate: row.dueDate.toISOString(),
  issuedAt: row.issuedAt.toISOString(),
  items: row.items.map((i) => ({
    id: i.id, description: i.description, qty: i.qty,
    unitPriceCentavos: Number(i.unitPriceCentavos), taxCentavos: Number(i.taxCentavos),
    source: i.source,
  })),
  payment: row.documentKind !== "NO_CHARGE" && row.payments[0] ? {
    method: row.payments[0].method,
    status: row.payments[0].status,
    tenderedCentavos: row.payments[0].cashTenderedCentavos == null ? null : Number(row.payments[0].cashTenderedCentavos),
    changeCentavos: row.payments[0].changeCentavos == null ? null : Number(row.payments[0].changeCentavos),
  } : null,
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

  /** Legacy work-order invoices kept booking identity only on the work order. */
  private async withWorkOrderAppointments(rows: InvoiceRow[]): Promise<InvoiceRow[]> {
    const ids = [...new Set(rows.filter(row => !row.appointment && row.workOrder?.appointmentId)
      .map(row => row.workOrder!.appointmentId!))];
    if (!ids.length) return rows;
    const appointments = await this.prisma.appointment.findMany({ where: { id: { in: ids } }, select: APPOINTMENT_SELECT });
    const byId = new Map(appointments.map(appointment => [appointment.id, appointment]));
    return rows.map(row => row.appointment || !row.workOrder?.appointmentId ? row
      : { ...row, appointment: byId.get(row.workOrder.appointmentId) ?? null });
  }

  private linkedVehicleId(invoice: InvoiceRow): string | null {
    const ids = [invoice.subscription?.vehicleId, invoice.appointment?.vehicleId, invoice.workOrder?.vehicleId]
      .filter((id): id is string => Boolean(id));
    if (new Set(ids).size > 1) {
      throw new DomainError("FORBIDDEN_ROLE", "Invoice vehicle references are inconsistent; administrator review is required", 403);
    }
    return ids[0] ?? null;
  }

  /** Subscription access is preserved; workshop access follows its actual vehicle. */
  private async findForUser(user: AbilityUser, id: string): Promise<InvoiceRow> {
    const loaded = await this.prisma.invoice.findUnique({ where: { id }, select: INVOICE_SELECT });
    if (!loaded) throw new DomainError("FORBIDDEN_ROLE", "Invoice not found", 404);
    const [invoice] = await this.withWorkOrderAppointments([loaded]);
    const vehicleId = this.linkedVehicleId(invoice);
    if (!invoice.subscription && !["ADMIN", "ADVISOR", "MEMBER", "FLEET_MANAGER"].includes(user.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "You cannot access this workshop bill", 403);
    }
    if (vehicleId) {
      await this.vehicles.findForUser(user, vehicleId, "read");
    } else if (user.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN_ROLE", "You cannot access this invoice", 403);
    }
    return invoice;
  }

  private async checkoutOrigins(rows: InvoiceRow[]): Promise<Set<string>> {
    if (!rows.length) return new Set();
    const markers = await this.prisma.auditLog.findMany({
      where: { action: MEMBER_CHECKOUT_ORIGIN, entityType: "Invoice", entityId: { in: rows.map((row) => row.id) } },
      select: { entityId: true, after: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return new Set(markers.filter((marker) => hasCheckoutOrigin(marker.after, byId.get(marker.entityId)?.subscriptionId ?? null)).map((marker) => marker.entityId));
  }

  async list(user: AbilityUser, scope?: "workshop") {
    if (scope === "workshop" && !["ADMIN", "ADVISOR"].includes(user.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "Only cash collectors may list workshop bills", 403);
    }
    if (user.role === "FLEET_MANAGER" && !user.orgId) return [];
    const vehicleOwner = user.role === "FLEET_MANAGER" ? { orgOwnerId: user.orgId } : { ownerUserId: user.id };
    const ownedInvoices: Prisma.InvoiceWhereInput[] = [{ subscription: { vehicle: vehicleOwner } }];
    if (["ADMIN", "ADVISOR", "MEMBER", "FLEET_MANAGER"].includes(user.role)) {
      ownedInvoices.push({ appointment: { vehicle: vehicleOwner } }, { workOrder: { vehicle: vehicleOwner } });
    }
    const loaded = await this.prisma.invoice.findMany({
      where: scope === "workshop"
        ? { subscriptionId: null, OR: [{ appointmentId: { not: null } }, { workOrderId: { not: null } }] }
        : { OR: ownedInvoices },
      select: INVOICE_SELECT,
      orderBy: { issuedAt: "desc" },
    });
    const rows = await this.withWorkOrderAppointments(loaded);
    rows.forEach((row) => this.linkedVehicleId(row));
    const origins = await this.checkoutOrigins(rows);
    return rows.map((row) => toInvoiceResponse(row, origins.has(row.id)));
  }

  async get(user: AbilityUser, id: string) {
    const row = await this.findForUser(user, id);
    const origins = await this.checkoutOrigins([row]);
    return toInvoiceResponse(row, origins.has(row.id));
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
    const objectPath = row.pdfObjectPath === this.documentPath(row) ? row.pdfObjectPath : await this.renderAndStore(row);
    const url = await this.storage.createDownloadUrl(objectPath, PDF_DOWNLOAD_EXPIRY_SECONDS);
    return { url };
  }

  private documentPath(row: InvoiceRow): string {
    // Workshop bill/receipt objects have different names: an in-flight unpaid render
    // cannot overwrite a receipt generated immediately after collection.
    if (row.appointmentId || row.workOrderId || (row.status === "PAID" && row.payments[0]?.method === "CASH")) {
      const document = row.documentKind === "NO_CHARGE" ? "no-charge"
        : row.status === "PAID" && row.payments[0] ? `receipt-${row.payments[0].id}` : `bill-${row.status.toLowerCase()}`;
      return `invoices/${row.id}/${row.number}-${document}.pdf`;
    }
    return `invoices/${row.id}/${row.number}.pdf`;
  }

  /** Renders the PDF for an already-loaded invoice row, stores it, and persists the object path. Reused by pdfUrl() and the BullMQ processor. */
  async renderAndStore(row: InvoiceRow): Promise<string> {
    const buffer = await renderInvoicePdf(
      {
        id: row.id, number: row.number, totalCentavos: Number(row.totalCentavos),
        status: row.status, issuedAt: row.issuedAt, dueDate: row.dueDate,
        documentKind: row.documentKind,
        appointmentId: row.appointmentId ?? row.workOrder?.appointmentId ?? undefined,
        workOrderId: row.workOrderId ?? undefined,
        plateNo: row.appointment?.vehicle.plateNo ?? row.workOrder?.vehicle.plateNo ?? row.subscription?.vehicle?.plateNo,
        serviceName: row.appointment?.serviceNameSnapshot ?? row.appointment?.serviceType.name,
      },
      row.items.map((i) => ({
        description: i.description, qty: i.qty,
        unitPriceCentavos: Number(i.unitPriceCentavos), taxCentavos: Number(i.taxCentavos),
        source: i.source,
      })),
      row.documentKind !== "NO_CHARGE" && row.payments[0] ? {
        method: row.payments[0].method, status: row.payments[0].status,
        amountCentavos: Number(row.payments[0].amountCentavos),
        tenderedCentavos: row.payments[0].cashTenderedCentavos == null ? undefined : Number(row.payments[0].cashTenderedCentavos),
        changeCentavos: row.payments[0].changeCentavos == null ? undefined : Number(row.payments[0].changeCentavos),
      } : undefined,
      row.subscription ? { id: row.subscription.id, paymentMethod: row.subscription.paymentMethod } : undefined,
      row.subscription?.plan ?? undefined,
    );
    const objectPath = this.documentPath(row);
    await this.storage.putObject(objectPath, buffer, "application/pdf");
    const stored = await this.prisma.invoice.updateMany({
      where: { id: row.id, status: row.status, documentKind: row.documentKind },
      data: { pdfObjectPath: objectPath },
    });
    if (!stored.count) return this.renderAndStore(await this.loadForRender(row.id));
    return objectPath;
  }

  /** Loads an invoice by id (no ownership check — used by the BullMQ processor, which runs as a trusted background worker). */
  async loadForRender(invoiceId: string): Promise<InvoiceRow> {
    const row = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: INVOICE_SELECT });
    return (await this.withWorkOrderAppointments([row]))[0];
  }
}
