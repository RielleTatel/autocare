import PDFDocument from "pdfkit";

/**
 * Ruling PDFKIT (Task 9 brief): the plan calls for a "headless renderer," but this environment
 * has no Docker and runs Node v24 — a headless-Chrome dependency would be heavy and CI-fragile.
 * `pdfkit` renders the receipt programmatically (no browser), which is deterministic and fast.
 */

export interface InvoicePdfInvoice {
  id: string;
  number: string;
  totalCentavos: number;
  status: string;
  issuedAt: Date;
  dueDate: Date;
}

export interface InvoicePdfItem {
  description: string;
  qty: number;
  unitPriceCentavos: number;
  taxCentavos: number;
}

export interface InvoicePdfPayment {
  method: string;
  status: string;
}

export interface InvoicePdfSubscription {
  id: string;
  paymentMethod?: string;
}

export interface InvoicePdfPlan {
  name: string;
  billingInterval: string;
}

const peso = (centavos: number) => `PHP ${(centavos / 100).toFixed(2)}`;

const VAT_RATE = 0.12; // BR: PH VAT is 12% (RA 10963 / TRAIN law).

/**
 * VAT treatment (documented per brief): line items created by SubscriptionsService/BillingService
 * (Tasks 2/8) do not currently populate `InvoiceItem.taxCentavos` — every existing invoice's
 * `totalCentavos` is therefore the plan's marketed, VAT-INCLUSIVE price. When no item carries an
 * explicit tax amount, this receipt derives the 12% VAT component from the inclusive total
 * (vatableSales = total / 1.12; vat = total - vatableSales) and shows the BIR-style breakdown.
 * If a future caller *does* populate per-item `taxCentavos` (a VAT-EXCLUSIVE line-item model),
 * those amounts are summed and shown as the VAT line instead, with the total taken as
 * subtotal + tax — so both pricing models render a correct breakdown without silently
 * double-counting tax.
 */
function computeVat(totalCentavos: number, items: InvoicePdfItem[]) {
  const explicitTax = items.reduce((sum, i) => sum + i.taxCentavos, 0);
  if (explicitTax > 0) {
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPriceCentavos, 0);
    return { vatableSales: subtotal, vat: explicitTax, total: subtotal + explicitTax, inclusive: false };
  }
  const vatableSales = Math.round(totalCentavos / (1 + VAT_RATE));
  const vat = totalCentavos - vatableSales;
  return { vatableSales, vat, total: totalCentavos, inclusive: true };
}

/**
 * Renders an itemized, BIR-style official-receipt PDF for an invoice. Pure function of its
 * inputs — no DB/storage access — so it is directly unit-testable.
 */
export async function renderInvoicePdf(
  invoice: InvoicePdfInvoice,
  items: InvoicePdfItem[],
  payment?: InvoicePdfPayment,
  subscription?: InvoicePdfSubscription,
  plan?: InvoicePdfPlan,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50, font: "Helvetica" });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).text("AutoCare+", { continued: false });
  doc.fontSize(10).fillColor("#555").text("Official Receipt / Invoice");
  doc.moveDown(1);
  doc.fillColor("#000");

  // OR-style / BIR sequence number: the invoice's own `number` (format INV-YYYY-NNNNNN, minted
  // by invoice-numbering.ts under a DB-serialized sequence) doubles as the BIR-facing OR number —
  // no separate sequence is maintained, since `Invoice.number` is already unique and monotonic.
  doc.fontSize(11).text(`OR / Invoice No.: ${invoice.number}`);
  doc.text(`Issued: ${invoice.issuedAt.toISOString().slice(0, 10)}`);
  doc.text(`Due: ${invoice.dueDate.toISOString().slice(0, 10)}`);
  doc.text(`Status: ${invoice.status}`);
  if (subscription) doc.text(`Subscription: ${subscription.id}`);
  if (plan) doc.text(`Plan: ${plan.name} (${plan.billingInterval})`);
  doc.moveDown(1);

  // Line items table (simple text columns — no external table library needed for this size).
  doc.fontSize(11).text("Items", { underline: true });
  doc.moveDown(0.25);
  const colX = { desc: 50, qty: 300, unit: 350, amount: 450 };
  doc.fontSize(9).fillColor("#555");
  doc.text("Description", colX.desc, doc.y, { continued: false });
  doc.text("Qty", colX.qty, doc.y - doc.currentLineHeight());
  doc.text("Unit", colX.unit, doc.y - doc.currentLineHeight());
  doc.text("Amount", colX.amount, doc.y - doc.currentLineHeight());
  doc.fillColor("#000");
  doc.moveDown(0.5);

  for (const item of items) {
    const y = doc.y;
    const amount = item.qty * item.unitPriceCentavos;
    doc.fontSize(10).text(item.description, colX.desc, y, { width: 240 });
    doc.text(String(item.qty), colX.qty, y);
    doc.text(peso(item.unitPriceCentavos), colX.unit, y);
    doc.text(peso(amount), colX.amount, y);
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  const { vatableSales, vat, total, inclusive } = computeVat(invoice.totalCentavos, items);
  doc.fontSize(10);
  doc.text(`VATable Sales: ${peso(vatableSales)}`, { align: "right" });
  doc.text(`VAT (12%)${inclusive ? " (VAT-inclusive price)" : ""}: ${peso(vat)}`, { align: "right" });
  doc.fontSize(12).text(`Total Amount Due: ${peso(total)}`, { align: "right" });
  doc.moveDown(1);

  if (payment) {
    doc.fontSize(10).text(`Payment Method: ${payment.method}`);
    doc.text(`Payment Status: ${payment.status}`);
    doc.moveDown(1);
  }

  doc.fontSize(8).fillColor("#555").text(
    "This serves as an Official Receipt. Retain for 10 years (BIR record-keeping requirement).",
    { align: "center" },
  );

  doc.end();
  return done;
}
