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
});
