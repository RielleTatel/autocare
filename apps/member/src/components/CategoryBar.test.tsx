import { fireEvent, render, screen } from "@testing-library/react-native";
import { vhsBands } from "@autocare/design-tokens";
import { CategoryBar } from "./CategoryBar";

describe("CategoryBar", () => {
  it("fills the bar to the score in the band colour", () => {
    render(<CategoryBar testID="bar" label="Brakes" score={55} />);
    expect(screen.getByTestId("bar-fill")).toHaveStyle({
      width: "55%",
      backgroundColor: vhsBands.NEEDS_ATTENTION.fill,
    });
  });

  it("clamps out-of-range scores to the track", () => {
    const { rerender } = render(<CategoryBar testID="bar" label="Brakes" score={140} />);
    expect(screen.getByTestId("bar-fill")).toHaveStyle({ width: "100%" });
    rerender(<CategoryBar testID="bar" label="Brakes" score={-20} />);
    expect(screen.getByTestId("bar-fill")).toHaveStyle({ width: "0%" });
  });

  it("shows the weight and point-count footnote that explains the number", () => {
    render(<CategoryBar label="Brakes" score={55} weight={22} points={9} />);
    expect(screen.getByText("Weight 22% · 9 points checked")).toBeTruthy();
  });

  it("omits the footnote entirely when neither figure is supplied", () => {
    render(<CategoryBar label="Brakes" score={55} />);
    expect(screen.queryByText(/points checked/)).toBeNull();
  });

  it("is only a button when it has an action", () => {
    const onPress = jest.fn();
    const { rerender } = render(<CategoryBar testID="bar" label="Brakes" score={55} />);
    expect(screen.queryByLabelText(/Tap to explain/)).toBeNull();

    rerender(<CategoryBar testID="bar" label="Brakes" score={55} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText("Brakes, score 55. Tap to explain."));
    expect(onPress).toHaveBeenCalled();
  });
});
