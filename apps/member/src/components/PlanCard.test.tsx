import { fireEvent, render, screen } from "@testing-library/react-native";
import { PlanCard } from "./PlanCard";

describe("PlanCard", () => {
  it("lists every inclusion in full", () => {
    const inclusions = ["2 inspections/cycle", "1 pick-up & delivery/cycle", "2 roadside call-outs/cycle"];
    render(<PlanCard name="Care Plus" price="₱1,499" inclusions={inclusions} />);
    for (const line of inclusions) {
      expect(screen.getByText(`• ${line}`)).toBeTruthy();
    }
  });

  it("shows the interval and lock-in", () => {
    render(<PlanCard name="Care Plus" price="₱1,499" interval="MONTHLY" lockInMonths={6} />);
    expect(screen.getByText("/month")).toBeTruthy();
    expect(screen.getByText("6-month lock-in")).toBeTruthy();
  });

  it("says No lock-in rather than '0-month lock-in'", () => {
    render(<PlanCard name="Care Basic" price="₱899" lockInMonths={0} />);
    expect(screen.getByText("No lock-in")).toBeTruthy();
  });

  it("fires onSelect and reports selection to assistive tech", () => {
    const onSelect = jest.fn();
    render(<PlanCard testID="plan" name="Care Plus" price="₱1,499" selected onSelect={onSelect} />);
    const card = screen.getByTestId("plan");
    expect(card.props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(card);
    expect(onSelect).toHaveBeenCalled();
  });

  it("does not fire when disabled", () => {
    const onSelect = jest.fn();
    render(<PlanCard testID="plan" name="Care Plus" price="₱1,499" disabled onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("plan"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
