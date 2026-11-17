import { InvoicesService } from "./invoices.service";
import { MEMBER_CHECKOUT_ORIGIN } from "../payments/checkout-policy";

function setup() {
  const invoice = {
    id: "invoice-1", number: "INV-2026-1", subscriptionId: "subscription-1", workOrderId: null,
    totalCentavos: 100000n, status: "AWAITING_AUTO_CHARGE", issuedAt: new Date(), dueDate: new Date(),
    pdfObjectPath: null, items: [], payments: [],
    subscription: { id: "subscription-1", vehicleId: "vehicle-1", status: "ACTIVE", paymentMethod: "E_PAYMENT", plan: { name: "Basic", billingInterval: "MONTHLY" } },
  };
  const marker = { entityId: "invoice-1", after: { kind: "INITIAL_SUBSCRIPTION", subscriptionId: "subscription-1" } };
  const prisma = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice), findMany: jest.fn().mockResolvedValue([invoice]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([marker]) },
  };
  const vehicles = { findForUser: jest.fn() };
  const service = new InvoicesService(prisma as never, vehicles as never, {} as never);
  return { service, prisma, invoice, marker, vehicles };
}
const user = { id: "member-1", role: "MEMBER" as const };

describe("Invoice recovery eligibility", () => {
  it("exposes the exact supported unpaid invoice on authenticated detail and revisit list", async () => {
    const { service, vehicles, prisma } = setup();
    await expect(service.get(user, "invoice-1")).resolves.toMatchObject({ id: "invoice-1", subscriptionId: "subscription-1", checkoutEligible: true, totalCentavos: 100000 });
    await expect(service.list(user)).resolves.toMatchObject([{ id: "invoice-1", checkoutEligible: true }]);
    expect(vehicles.findForUser).toHaveBeenCalledWith(user, "vehicle-1", "read");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({ where: { action: MEMBER_CHECKOUT_ORIGIN, entityType: "Invoice", entityId: { in: ["invoice-1"] } }, select: { entityId: true, after: true } });
  });

  it.each(["PAID", "CANCELLED", "COD", "UNMARKED", "MISMATCHED_ORIGIN", "ETF", "ZERO"])("does not advertise checkout for %s", async (kind) => {
    const { service, invoice, marker, prisma } = setup();
    if (kind === "PAID") invoice.status = "PAID";
    if (kind === "CANCELLED") invoice.subscription.status = "CANCELLED";
    if (kind === "COD") invoice.subscription.paymentMethod = "COD";
    if (kind === "UNMARKED") prisma.auditLog.findMany.mockResolvedValue([]);
    if (kind === "MISMATCHED_ORIGIN") marker.after.subscriptionId = "different-subscription";
    if (kind === "ETF") marker.after.kind = "EARLY_TERMINATION";
    if (kind === "ZERO") invoice.totalCentavos = 0n;
    await expect(service.get(user, "invoice-1")).resolves.toMatchObject({ checkoutEligible: false });
  });

  it("does not reveal payment eligibility before invoice ownership is checked", async () => {
    const { service, vehicles, prisma } = setup();
    vehicles.findForUser.mockRejectedValue(new Error("ownership denied"));
    await expect(service.get(user, "invoice-1")).rejects.toThrow("ownership denied");
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
