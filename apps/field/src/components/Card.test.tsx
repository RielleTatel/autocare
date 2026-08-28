import { render, fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children on a hairline surface", () => {
    render(<Card><Text>Brakes</Text></Card>);
    expect(screen.getByText("Brakes")).toBeTruthy();
  });

  it("becomes a button when given an onPress", () => {
    const onPress = jest.fn();
    render(<Card onPress={onPress} accessibilityLabel="Open brakes"><Text>Brakes</Text></Card>);
    fireEvent.press(screen.getByLabelText("Open brakes"));
    expect(onPress).toHaveBeenCalled();
  });

  it("draws the accent edge at the token width", () => {
    render(<Card testID="c" accent="#B3261E"><Text>x</Text></Card>);
    expect(screen.getByTestId("c").props.style.borderLeftWidth).toBe(5);
  });
});
