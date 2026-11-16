import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CheckoutInvoice, InvoicePaymentScreen } from "./InvoicePaymentScreen";
const invoice = { id: "i1", number: "INV-1", subscriptionId: "s1", totalCentavos: 50000, status: "INVOICE_ISSUED", issuedAt: "2026-11-16", dueDate: "2026-11-16", items: [], checkoutEligible: true } as CheckoutInvoice;
function props() {
  return { invoiceId: "i1", fetchInvoice: jest.fn().mockResolvedValue(invoice), createPaymentIntent: jest.fn().mockResolvedValue({ checkoutUrl: "https://checkout.paymongo.com/i1" }),
    openCheckout: jest.fn().mockResolvedValue({ type: "success", url: "https://preview.example/payment-result?invoiceId=i1&outcome=success" }),
    onDownloadReceipt: jest.fn(), onBack: jest.fn(), pollDelayMs: 0, pollAttempts: 2 };
}
it("does not accept a browser success as payment, bounds checking, then discovers delayed settlement", async () => {
  const p = props(); const screen = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => screen.getByTestId("pay-invoice"));
  fireEvent.press(screen.getByTestId("pay-invoice"));
  await waitFor(() => expect(screen.getByTestId("payment-pending")).toHaveTextContent(/Awaiting payment confirmation/));
  expect(screen.queryByTestId("payment-paid")).toBeNull();
  expect(p.fetchInvoice).toHaveBeenCalledTimes(5); // mount, preflight, return, two bounded checks
  p.fetchInvoice.mockResolvedValue({ ...invoice, status: "PAID", checkoutEligible: false });
  fireEvent.press(screen.getByTestId("check-payment"));
  await waitFor(() => screen.getByTestId("payment-paid"));
  expect(screen.queryByTestId("pay-invoice")).toBeNull();
});
it("cancel → revisit → retry uses the original invoice and never creates a subscription", async () => {
  const p = props(); p.openCheckout.mockResolvedValue({ type: "cancel" } as any);
  const first = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => first.getByTestId("pay-invoice")); fireEvent.press(first.getByTestId("pay-invoice"));
  await waitFor(() => first.getByTestId("payment-cancelled"));
  first.unmount();
  const reopened = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => reopened.getByTestId("pay-invoice")); fireEvent.press(reopened.getByTestId("pay-invoice"));
  await waitFor(() => expect(p.createPaymentIntent).toHaveBeenCalledTimes(2));
  expect(p.createPaymentIntent.mock.calls.map(call => call[0])).toEqual(["i1", "i1"]);
  expect(p.createPaymentIntent.mock.calls[0][1]).not.toBe(p.createPaymentIntent.mock.calls[1][1]);
});
it("reuses an uncertain checkout initiation key after a provider/network error", async () => {
  const p = props(); p.createPaymentIntent.mockRejectedValueOnce(new Error("Connection lost"));
  const screen = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => screen.getByTestId("pay-invoice")); fireEvent.press(screen.getByTestId("pay-invoice"));
  await waitFor(() => screen.getByTestId("payment-error")); fireEvent.press(screen.getByTestId("pay-invoice"));
  await waitFor(() => expect(p.createPaymentIntent).toHaveBeenCalledTimes(2));
  expect(p.createPaymentIntent.mock.calls[0][1]).toBe(p.createPaymentIntent.mock.calls[1][1]);
});
it("refreshes a stale unpaid invoice before checkout and refuses payment when already settled", async () => {
  const p = props(); const screen = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => screen.getByTestId("pay-invoice"));
  p.fetchInvoice.mockResolvedValue({ ...invoice, status: "PAID", checkoutEligible: false });
  fireEvent.press(screen.getByTestId("pay-invoice"));
  await waitFor(() => screen.getByTestId("payment-paid"));
  expect(p.createPaymentIntent).not.toHaveBeenCalled();
});
it("shows paid on revisit even without a successful checkout callback, and excludes unsupported invoices", async () => {
  const p = props(); p.fetchInvoice.mockResolvedValue({ ...invoice, checkoutEligible: false });
  const screen = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => screen.getByTestId("invoice-not-payable"));
  expect(screen.queryByTestId("pay-invoice")).toBeNull();
});

it("recognizes the configured provider cancellation URL without waiting for payment", async () => {
  const p = props(); p.openCheckout.mockResolvedValue({ type: "success", url: "https://preview.example/payment-result?invoiceId=i1&outcome=cancelled" });
  const screen = render(<InvoicePaymentScreen {...p} />);
  await waitFor(() => screen.getByTestId("pay-invoice")); fireEvent.press(screen.getByTestId("pay-invoice"));
  await waitFor(() => screen.getByTestId("payment-cancelled"));
  expect(screen.queryByTestId("payment-pending")).toBeNull();
  expect(p.fetchInvoice).toHaveBeenCalledTimes(3);
});

it("a same-tab provider return remount checks the authoritative invoice until settlement", async () => {
  const p = props();
  p.fetchInvoice.mockResolvedValueOnce(invoice).mockResolvedValueOnce(invoice).mockResolvedValue({ ...invoice, status: "PAID", checkoutEligible: false });
  const screen = render(<InvoicePaymentScreen {...p} returnOutcome="returned" />);
  await waitFor(() => screen.getByTestId("payment-paid"));
  expect(p.createPaymentIntent).not.toHaveBeenCalled();
  expect(p.openCheckout).not.toHaveBeenCalled();
});
it("a same-tab cancelled return remount keeps the original unpaid invoice recoverable", async () => {
  const p = props();
  const screen = render(<InvoicePaymentScreen {...p} returnOutcome="cancelled" />);
  await waitFor(() => screen.getByTestId("payment-cancelled"));
  expect(screen.queryByTestId("payment-pending")).toBeNull();
  expect(p.fetchInvoice).toHaveBeenCalledTimes(1);
  expect(p.createPaymentIntent).not.toHaveBeenCalled();
});
