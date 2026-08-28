import { render, fireEvent, screen } from "@testing-library/react-native";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("meets the 56dp gloved target", () => {
    render(<FormField accessibilityLabel="Quantity" testID="q" />);
    expect(screen.getByTestId("q").props.style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("reports errors in sentence form, not as a code", () => {
    render(<FormField accessibilityLabel="Quantity" error="Enter a quantity greater than zero." />);
    expect(screen.getByText("Enter a quantity greater than zero.")).toBeTruthy();
  });

  it("passes text changes up", () => {
    const onChangeText = jest.fn();
    render(<FormField accessibilityLabel="Quantity" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText("Quantity"), "2.5");
    expect(onChangeText).toHaveBeenCalledWith("2.5");
  });

  it("masks input when asked, for passwords", () => {
    render(<FormField accessibilityLabel="Password" secureTextEntry />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("tags its error text with a testID a screen can assert on", () => {
    render(<FormField accessibilityLabel="Password" error="Wrong email or password" errorTestID="staff-login-error" />);
    expect(screen.getByTestId("staff-login-error")).toHaveTextContent("Wrong email or password");
  });
});
