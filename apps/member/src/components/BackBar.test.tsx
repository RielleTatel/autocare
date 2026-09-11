import { fireEvent, render, screen } from "@testing-library/react-native";
import { BackBar } from "./BackBar";

describe("BackBar", () => {
  it("goes back when pressed", () => {
    const onBack = jest.fn();
    render(<BackBar onBack={onBack} />);
    fireEvent.press(screen.getByTestId("back-bar"));
    expect(onBack).toHaveBeenCalled();
  });

  it("names itself to assistive tech, since a chevron alone says nothing", () => {
    render(<BackBar onBack={jest.fn()} />);
    expect(screen.getByLabelText("Go back")).toBeTruthy();
  });

  it("shows an optional title beside the chevron", () => {
    render(<BackBar onBack={jest.fn()} title="Roadside assistance" />);
    screen.getByText("Roadside assistance");
  });

  // A screen reached as a tab root has nowhere to go back to; rendering a dead
  // chevron there would be worse than rendering nothing.
  it("renders nothing without a handler", () => {
    const { toJSON } = render(<BackBar />);
    expect(toJSON()).toBeNull();
  });

  // 48dp is the member-app minimum (NFR-027) and this is a one-handed,
  // roadside-stress target.
  it("meets the minimum touch target", () => {
    render(<BackBar onBack={jest.fn()} />);
    const style = screen.getByTestId("back-bar").props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.minHeight).toBeGreaterThanOrEqual(48);
  });
});
