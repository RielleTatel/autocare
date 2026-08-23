import { fireEvent, render } from "@testing-library/react-native";
import { ServiceTypeScreen } from "./ServiceTypeScreen";
import type { BookingServiceType } from "./bookingApi";
import type { EntitlementSummary } from "@autocare/contracts";

const inspection: BookingServiceType = { id: "st1", code: "INSP", name: "Inspection", standardDurationMin: 60, priceCentavos: 50000, entitlementType: "INSPECTION" };
const detailing: BookingServiceType = { id: "st2", code: "DETAIL", name: "Detailing", standardDurationMin: 120, priceCentavos: 120000, entitlementType: null };

describe("ServiceTypeScreen", () => {
  it("shows an entitlement badge when the plan still has that entitlement, price otherwise", () => {
    const entitlements: EntitlementSummary[] = [{ entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 1, remaining: 1 }];
    const { getByTestId, queryByTestId } = render(
      <ServiceTypeScreen serviceTypes={[inspection, detailing]} entitlements={entitlements} onSelect={jest.fn()} />,
    );
    // Inspection has a remaining entitlement → badge, no price
    expect(getByTestId("badge-INSP")).toBeTruthy();
    expect(queryByTestId("price-INSP")).toBeNull();
    // Detailing has no entitlement type → price shown
    expect(getByTestId("price-DETAIL")).toBeTruthy();
  });

  it("shows price for an entitlement-backed service once it is exhausted", () => {
    const entitlements: EntitlementSummary[] = [{ entitlementType: "INSPECTION", quantityPerCycle: 2, usedQty: 2, remaining: 0 }];
    const { getByTestId, queryByTestId } = render(
      <ServiceTypeScreen serviceTypes={[inspection]} entitlements={entitlements} onSelect={jest.fn()} />,
    );
    expect(queryByTestId("badge-INSP")).toBeNull();
    expect(getByTestId("price-INSP")).toBeTruthy();
  });

  it("calls onSelect with the chosen service", () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<ServiceTypeScreen serviceTypes={[inspection]} entitlements={[]} onSelect={onSelect} />);
    fireEvent.press(getByTestId("service-INSP"));
    expect(onSelect).toHaveBeenCalledWith(inspection);
  });
});
