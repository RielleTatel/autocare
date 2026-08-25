import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "./EmptyState";

describe("member EmptyState", () => {
  it("shows title and body", () => {
    render(<EmptyState title="Nothing yet" body="Add a vehicle to begin." />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Add a vehicle to begin.")).toBeTruthy();
  });
});
