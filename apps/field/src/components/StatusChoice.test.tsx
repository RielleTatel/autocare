import { render, fireEvent, screen } from "@testing-library/react-native";
import { StatusChoice } from "./StatusChoice";

describe("StatusChoice", () => {
  it("labels itself with the human status and meets the gloved target", () => {
    render(<StatusChoice status="ATTENTION" selected={false} testID="c" />);
    expect(screen.getByLabelText("Attention")).toBeTruthy();
    expect(screen.getByTestId("c").props.style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("announces selection to assistive tech", () => {
    render(<StatusChoice status="GOOD" selected />);
    expect(screen.getByLabelText("Good").props.accessibilityState.selected).toBe(true);
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    render(<StatusChoice status="GOOD" selected={false} disabled onPress={onPress} />);
    fireEvent.press(screen.getByLabelText("Good"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
