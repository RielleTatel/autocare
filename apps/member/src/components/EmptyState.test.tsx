import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "./EmptyState";

describe("member EmptyState", () => {
  it("shows title and body", () => {
    render(<EmptyState title="Nothing yet" body="Add a vehicle to begin." />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Add a vehicle to begin.")).toBeTruthy();
  });

  it("gives the empty screen something to look at when an icon is supplied", () => {
    render(<EmptyState title="No upcoming services" icon="calendar-days" />);
    expect(screen.getByTestId("empty-state-icon")).toBeTruthy();
  });

  it("stays text-only by default, so existing call sites are unchanged", () => {
    render(<EmptyState title="Nothing yet" />);
    expect(screen.queryByTestId("empty-state-icon")).toBeNull();
  });
});
