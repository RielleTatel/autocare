import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "./Button";

describe("member Button", () => {
  it("renders label and fires onPress", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Book a service</Button>);
    fireEvent.press(screen.getByText("Book a service"));
    expect(onPress).toHaveBeenCalled();
  });
  it("does not fire when disabled", () => {
    const onPress = jest.fn();
    render(<Button disabled onPress={onPress}>Nope</Button>);
    fireEvent.press(screen.getByText("Nope"));
    expect(onPress).not.toHaveBeenCalled();
  });
  it("announces a busy state and prevents repeat presses while loading", () => {
    const onPress = jest.fn();
    render(<Button loading testID="action" onPress={onPress}>Signing in…</Button>);

    expect(screen.getByTestId("action-loading")).toBeTruthy();
    expect(screen.getByTestId("action").props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(screen.getByTestId("action"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
