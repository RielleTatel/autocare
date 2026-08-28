import { render, fireEvent, screen } from "@testing-library/react-native";
import { FieldNav } from "./FieldNav";

describe("FieldNav", () => {
  it("shows the screen title", () => {
    render(<FieldNav title="Brakes · 1 of 4" />);
    expect(screen.getByText("Brakes · 1 of 4")).toBeTruthy();
  });

  it("offers a back affordance only when it can go back", () => {
    const onBack = jest.fn();
    const { rerender } = render(<FieldNav title="Sync queue" onBack={onBack} />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalled();

    rerender(<FieldNav title="Today" />);
    expect(screen.queryByLabelText("Back")).toBeNull();
  });
});
