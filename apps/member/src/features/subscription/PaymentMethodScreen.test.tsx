import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaymentMethodScreen } from "./PaymentMethodScreen";
import { Plan, Subscription } from "@autocare/contracts";

const plan: Plan = {
  id: "p1", code: "BASIC", name: "Basic", priceCentavos: 150000, billingInterval: "MONTHLY",
  lockInMonths: 6, isActive: true, version: 1,
  entitlements: [{ id: "e1", entitlementType: "INSPECTION", quantityPerCycle: 1, overagePriceCentavos: 20000 }],
};

const sub: Subscription = {
  id: "s1", vehicleId: "v1", planId: "p1", userId: "u1", status: "ACTIVE",
  startedAt: "2026-08-01T00:00:00Z", lockInEndsAt: "2027-02-01T00:00:00Z",
  currentPeriodStart: "2026-08-01T00:00:00Z", currentPeriodEnd: "2026-09-01T00:00:00Z",
  paymentMethod: "COD", cancelRequestedAt: null, pendingPlanId: null,
};

function props(over: Partial<Parameters<typeof PaymentMethodScreen>[0]> = {}) {
  return {
    plan,
    createSubscription: jest.fn().mockResolvedValue(sub),
    createPaymentIntent: jest.fn().mockResolvedValue({ checkoutUrl: "https://checkout.example/x" }),
    openCheckout: jest.fn().mockResolvedValue({ type: "success" }),
    refreshSubscriptionStatus: jest.fn().mockResolvedValue({ ...sub, status: "ACTIVE" }),
    onDone: jest.fn(),
    ...over,
  };
}

describe("PaymentMethodScreen", () => {
  it("COD path: selecting COD and confirming calls createSubscription with COD, then shows the pay-at-counter confirmation", async () => {
    const p = props();
    const { getByTestId } = render(<PaymentMethodScreen {...p} />);
    fireEvent.press(getByTestId("method-cod"));
    fireEvent.press(getByTestId("confirm-cod"));
    expect(p.createSubscription).toHaveBeenCalledWith("COD");
    await waitFor(() => getByTestId("cod-confirmation"));
    fireEvent.press(getByTestId("cod-continue"));
    expect(p.onDone).toHaveBeenCalledWith(sub);
  });

  it("E_PAYMENT path: creates subscription, an intent, opens checkout, then refreshes status on success", async () => {
    const p = props();
    const { getByTestId } = render(<PaymentMethodScreen {...p} />);
    fireEvent.press(getByTestId("method-epayment"));
    fireEvent.press(getByTestId("confirm-epayment"));
    expect(p.createSubscription).toHaveBeenCalledWith("E_PAYMENT");
    await waitFor(() => expect(p.onDone).toHaveBeenCalled());
    expect(p.createPaymentIntent).toHaveBeenCalledWith(sub);
    expect(p.openCheckout).toHaveBeenCalledWith("https://checkout.example/x");
    expect(p.refreshSubscriptionStatus).toHaveBeenCalledWith("s1");
  });

  it("E_PAYMENT path: shows an error and does not call onDone if checkout is cancelled", async () => {
    const p = props({ openCheckout: jest.fn().mockResolvedValue({ type: "cancel" }) });
    const { getByTestId } = render(<PaymentMethodScreen {...p} />);
    fireEvent.press(getByTestId("method-epayment"));
    fireEvent.press(getByTestId("confirm-epayment"));
    await waitFor(() => getByTestId("payment-error"));
    expect(p.onDone).not.toHaveBeenCalled();
  });
});
