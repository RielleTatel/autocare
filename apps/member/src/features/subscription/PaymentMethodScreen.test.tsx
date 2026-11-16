import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaymentMethodScreen } from "./PaymentMethodScreen";
import { Plan } from "@autocare/contracts";
const plan = { id: "p1", name: "Basic", priceCentavos: 150000 } as Plan;
const sub = { id: "s1", invoiceId: "i1", paymentMethod: "E_PAYMENT" };
const props = () => ({ plan, createSubscription: jest.fn().mockResolvedValue(sub), onCheckoutInvoice: jest.fn(), onDone: jest.fn() });
it("creates one subscription/invoice then opens the exact invoice, without claiming payment success", async () => {
  const p = props();
  const screen = render(<PaymentMethodScreen {...p} />);
  fireEvent.press(screen.getByTestId("method-epayment"));
  fireEvent.press(screen.getByTestId("confirm-epayment"));
  fireEvent.press(screen.getByTestId("confirm-epayment"));
  await waitFor(() => expect(p.onCheckoutInvoice).toHaveBeenCalledWith("i1", sub));
  expect(p.createSubscription).toHaveBeenCalledTimes(1);
  expect(p.onDone).not.toHaveBeenCalled();
});
it("retains the created subscription if a navigation/checkout connection fails", async () => {
  const p = props();
  p.onCheckoutInvoice.mockImplementationOnce(() => { throw new Error("Could not open invoice"); });
  const screen = render(<PaymentMethodScreen {...p} />);
  fireEvent.press(screen.getByTestId("method-epayment"));
  fireEvent.press(screen.getByTestId("confirm-epayment"));
  await waitFor(() => screen.getByTestId("payment-error"));
  fireEvent.press(screen.getByTestId("confirm-epayment"));
  await waitFor(() => expect(p.onCheckoutInvoice).toHaveBeenCalledTimes(2));
  expect(p.createSubscription).toHaveBeenCalledTimes(1);
});
it("preserves the cash-at-counter confirmation without marking it paid", async () => {
  const p = props(); p.createSubscription.mockResolvedValue({ ...sub, paymentMethod: "COD" });
  const screen = render(<PaymentMethodScreen {...p} />);
  fireEvent.press(screen.getByTestId("method-cod")); fireEvent.press(screen.getByTestId("confirm-cod"));
  await waitFor(() => screen.getByTestId("cod-confirmation"));
  fireEvent.press(screen.getByTestId("cod-continue"));
  expect(p.onCheckoutInvoice).not.toHaveBeenCalled();
  expect(p.onDone).toHaveBeenCalled();
});
