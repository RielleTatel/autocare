import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { UpgradeDowngradeScreen } from "./UpgradeDowngradeScreen";
import { Plan } from "@autocare/contracts";

const currentPlan: Plan = {
  id: "p1", code: "BASIC", name: "Basic", priceCentavos: 150000, billingInterval: "MONTHLY",
  lockInMonths: 6, isActive: true, version: 1, entitlements: [],
};
const premiumPlan: Plan = { ...currentPlan, id: "p2", code: "PREMIUM", name: "Premium", priceCentavos: 300000 };
const liteplan: Plan = { ...currentPlan, id: "p3", code: "LITE", name: "Lite", priceCentavos: 50000 };

describe("UpgradeDowngradeScreen", () => {
  it("shows a pro-ration preview after confirming an upgrade", async () => {
    const fetchPlans = jest.fn().mockResolvedValue([currentPlan, premiumPlan]);
    const onUpgrade = jest.fn().mockResolvedValue({ id: "s1", proratedChargeCentavos: 45000 });
    const { getByTestId } = render(
      <UpgradeDowngradeScreen currentPlan={currentPlan} fetchPlans={fetchPlans} onUpgrade={onUpgrade} onDowngrade={jest.fn()} onDone={jest.fn()} />,
    );
    await waitFor(() => getByTestId("change-plan-p2"));
    fireEvent.press(getByTestId("change-plan-p2"));
    fireEvent.press(getByTestId("confirm-change"));
    await waitFor(() => getByTestId("change-result"));
    expect(onUpgrade).toHaveBeenCalledWith("p2");
    expect(getByTestId("change-result").props.children).toMatch(/₱450\.00/);
  });

  it("shows a next-cycle message after confirming a downgrade", async () => {
    const fetchPlans = jest.fn().mockResolvedValue([currentPlan, liteplan]);
    const onDowngrade = jest.fn().mockResolvedValue({ id: "s1", effectiveAt: "2026-09-01T00:00:00Z" });
    const { getByTestId } = render(
      <UpgradeDowngradeScreen currentPlan={currentPlan} fetchPlans={fetchPlans} onUpgrade={jest.fn()} onDowngrade={onDowngrade} onDone={jest.fn()} />,
    );
    await waitFor(() => getByTestId("change-plan-p3"));
    fireEvent.press(getByTestId("change-plan-p3"));
    fireEvent.press(getByTestId("confirm-change"));
    await waitFor(() => getByTestId("change-result"));
    expect(onDowngrade).toHaveBeenCalledWith("p3");
    expect(getByTestId("change-result").props.children).toMatch(/No charge today/i);
  });
});
