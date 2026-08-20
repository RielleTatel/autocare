import { fireEvent, render } from "@testing-library/react-native";
import { PhoneEntryScreen } from "./PhoneEntryScreen";

describe("PhoneEntryScreen", () => {
  it("disables Continue until a valid PH mobile is entered", () => {
    const { getByPlaceholderText, getByTestId } = render(<PhoneEntryScreen onSubmit={jest.fn()} onGoogle={jest.fn()} />);
    expect(getByTestId("continue").props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByPlaceholderText("917 123 4567"), "9171234567");
    expect(getByTestId("continue").props.accessibilityState.disabled).toBe(false);
  });
  it("submits E.164 format", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByTestId } = render(<PhoneEntryScreen onSubmit={onSubmit} onGoogle={jest.fn()} />);
    fireEvent.changeText(getByPlaceholderText("917 123 4567"), "9171234567");
    fireEvent.press(getByTestId("continue"));
    expect(onSubmit).toHaveBeenCalledWith("+639171234567");
  });
});
