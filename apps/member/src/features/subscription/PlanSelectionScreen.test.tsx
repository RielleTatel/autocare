import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PlanSelectionScreen } from "./PlanSelectionScreen";
import { Plan } from "@autocare/contracts";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1", code: "BASIC", name: "Basic", priceCentavos: 150000, billingInterval: "MONTHLY",
  lockInMonths: 6, isActive: true, version: 1,
  entitlements: [{ id: "e1", entitlementType: "INSPECTION", quantityPerCycle: 1, overagePriceCentavos: 20000 }],
  ...over,
});

describe("PlanSelectionScreen", () => {
  it("renders tier cards from the fetched plan list", async () => {
    const fetchPlans = jest.fn().mockResolvedValue([plan(), plan({ id: "p2", name: "Premium", priceCentavos: 300000 })]);
    const { getByTestId, getByText } = render(<PlanSelectionScreen fetchPlans={fetchPlans} onSelectPlan={jest.fn()} />);
    await waitFor(() => getByTestId("plan-p1"));
    getByText("Basic");
    getByText("Premium");
    getByText(/₱1500\.00/);
  });

  it("calls onSelectPlan with the chosen plan", async () => {
    const fetchPlans = jest.fn().mockResolvedValue([plan()]);
    const onSelectPlan = jest.fn();
    const { getByTestId } = render(<PlanSelectionScreen fetchPlans={fetchPlans} onSelectPlan={onSelectPlan} />);
    await waitFor(() => getByTestId("plan-p1"));
    fireEvent.press(getByTestId("plan-p1"));
    expect(onSelectPlan).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("shows an error if plans fail to load", async () => {
    const fetchPlans = jest.fn().mockRejectedValue(new Error("Network down"));
    const { getByTestId } = render(<PlanSelectionScreen fetchPlans={fetchPlans} onSelectPlan={jest.fn()} />);
    await waitFor(() => getByTestId("plans-error"));
  });
});
