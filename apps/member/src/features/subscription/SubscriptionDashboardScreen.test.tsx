import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SubscriptionDashboardScreen } from "./SubscriptionDashboardScreen";
import { SubscriptionWithPlan } from "./subscriptionApi";

const subscription: SubscriptionWithPlan = {
  id: "s1", vehicleId: "v1", planId: "p1", userId: "u1", status: "ACTIVE",
  startedAt: "2026-08-01T00:00:00Z", lockInEndsAt: "2027-02-01T00:00:00Z",
  currentPeriodStart: "2026-08-01T00:00:00Z", currentPeriodEnd: "2026-09-01T00:00:00Z",
  paymentMethod: "COD", cancelRequestedAt: null, pendingPlanId: null,
  plan: { id: "p1", code: "BASIC", name: "Basic", priceCentavos: 150000, billingInterval: "MONTHLY", lockInMonths: 6 },
};

const entitlements = [{ entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 1, remaining: 1 }];

describe("SubscriptionDashboardScreen", () => {
  it("renders next billing date, entitlement gauges, lock-in countdown, and status", async () => {
    const fetchDashboard = jest.fn().mockResolvedValue({ subscription, entitlements });
    const { getByTestId, getByText } = render(
      <SubscriptionDashboardScreen fetchDashboard={fetchDashboard} onManagePlan={jest.fn()} onCancel={jest.fn()} onViewInvoices={jest.fn()} />,
    );
    await waitFor(() => getByTestId("status-banner"));
    getByText("ACTIVE");
    getByText(/1 of 2 inspections left/);
    getByTestId("next-billing");
    getByTestId("lockin-countdown");
  });

  it("wires the manage/cancel/invoices actions", async () => {
    const fetchDashboard = jest.fn().mockResolvedValue({ subscription, entitlements });
    const onManagePlan = jest.fn();
    const onCancel = jest.fn();
    const onViewInvoices = jest.fn();
    const { getByTestId } = render(
      <SubscriptionDashboardScreen fetchDashboard={fetchDashboard} onManagePlan={onManagePlan} onCancel={onCancel} onViewInvoices={onViewInvoices} />,
    );
    await waitFor(() => getByTestId("manage-plan"));
    fireEvent.press(getByTestId("manage-plan"));
    fireEvent.press(getByTestId("cancel-subscription"));
    fireEvent.press(getByTestId("view-invoices"));
    expect(onManagePlan).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(onViewInvoices).toHaveBeenCalled();
  });

  it("shows GRACE status messaging distinctly", async () => {
    const fetchDashboard = jest.fn().mockResolvedValue({ subscription: { ...subscription, status: "GRACE" }, entitlements });
    const { getByTestId, getByText } = render(
      <SubscriptionDashboardScreen fetchDashboard={fetchDashboard} onManagePlan={jest.fn()} onCancel={jest.fn()} onViewInvoices={jest.fn()} />,
    );
    await waitFor(() => getByTestId("status-banner"));
    getByText(/grace period/i);
  });
});
