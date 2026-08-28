import { render, fireEvent, screen } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  it("meets the 56dp gloved touch target", () => {
    render(<Button testID="b">Save & next</Button>);
    const style = screen.getByTestId("b").props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("labels itself from a string child", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Submit inspection</Button>);
    fireEvent.press(screen.getByLabelText("Submit inspection"));
    expect(onPress).toHaveBeenCalled();
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    render(<Button disabled onPress={onPress}>Submit inspection</Button>);
    fireEvent.press(screen.getByLabelText("Submit inspection"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
