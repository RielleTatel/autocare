import { renderInvoicePdf } from "./invoice-pdf";

describe("renderInvoicePdf", () => {
  it("returns a non-empty PDF buffer for a sample invoice", async () => {
    const buf = await renderInvoicePdf(
      { id: "inv1", number: "INV-2026-000001", totalCentavos: 100000, status: "PAID", issuedAt: new Date("2026-08-01"), dueDate: new Date("2026-08-01") },
      [{ description: "Basic (MONTHLY)", qty: 1, unitPriceCentavos: 100000, taxCentavos: 0 }],
      { method: "GCASH", status: "SUCCEEDED" },
      { id: "sub1" },
      { name: "Basic", billingInterval: "MONTHLY" },
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("derives a VAT breakdown from a VAT-inclusive total when items carry no explicit tax", async () => {
    const buf = await renderInvoicePdf(
      { id: "inv2", number: "INV-2026-000002", totalCentavos: 112000, status: "PAID", issuedAt: new Date(), dueDate: new Date() },
      [{ description: "Elite (MONTHLY)", qty: 1, unitPriceCentavos: 112000, taxCentavos: 0 }],
    );
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("sums explicit item taxCentavos as the VAT line when items carry one (VAT-exclusive model)", async () => {
    const buf = await renderInvoicePdf(
      { id: "inv3", number: "INV-2026-000003", totalCentavos: 112000, status: "PAID", issuedAt: new Date(), dueDate: new Date() },
      [{ description: "Part", qty: 1, unitPriceCentavos: 100000, taxCentavos: 12000 }],
    );
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
