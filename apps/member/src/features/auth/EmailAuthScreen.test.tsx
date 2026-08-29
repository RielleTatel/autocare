import { fireEvent, render } from "@testing-library/react-native";
import { EmailAuthScreen } from "./EmailAuthScreen";

const noop = jest.fn();
const props = () => ({ onSignIn: jest.fn(), onRegister: jest.fn(), onGoogle: jest.fn(), onForgotPassword: jest.fn() });

describe("EmailAuthScreen", () => {
  it("disables submit until a valid email and 6+ char password are entered", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} />);
    expect(getByTestId("submit").props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId("email-input"), "juan@example.com");
    fireEvent.changeText(getByTestId("password-input"), "12345"); // too short
    expect(getByTestId("submit").props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId("password-input"), "123456");
    expect(getByTestId("submit").props.accessibilityState.disabled).toBe(false);
  });

  it("signs in with email + password in sign-in mode", () => {
    const p = props();
    const { getByTestId } = render(<EmailAuthScreen {...p} />);
    fireEvent.changeText(getByTestId("email-input"), "juan@example.com");
    fireEvent.changeText(getByTestId("password-input"), "s3cret!");
    fireEvent.press(getByTestId("submit"));
    expect(p.onSignIn).toHaveBeenCalledWith("juan@example.com", "s3cret!");
    expect(p.onRegister).not.toHaveBeenCalled();
  });

  it("registers when toggled to create-account mode", () => {
    const p = props();
    const { getByTestId } = render(<EmailAuthScreen {...p} />);
    fireEvent.press(getByTestId("toggle-mode"));
    fireEvent.changeText(getByTestId("email-input"), "new@example.com");
    fireEvent.changeText(getByTestId("password-input"), "s3cret!");
    fireEvent.press(getByTestId("submit"));
    expect(p.onRegister).toHaveBeenCalledWith("new@example.com", "s3cret!");
    expect(p.onSignIn).not.toHaveBeenCalled();
  });

  it("triggers password reset with the entered email in sign-in mode", () => {
    const p = props();
    const { getByTestId } = render(<EmailAuthScreen {...p} />);
    fireEvent.changeText(getByTestId("email-input"), "juan@example.com");
    fireEvent.press(getByTestId("forgot-password"));
    expect(p.onForgotPassword).toHaveBeenCalledWith("juan@example.com");
  });

  it("shows an error message when provided", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} error="That email or password didn't work." />);
    expect(getByTestId("error").props.children).toBe("That email or password didn't work.");
  });

  it("shows a notice message when provided", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} notice="Verification email sent." />);
    expect(getByTestId("notice").props.children).toBe("Verification email sent.");
  });

  it("masks the password until the reveal toggle is pressed", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} />);
    expect(getByTestId("password-input").props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId("toggle-password"));
    expect(getByTestId("password-input").props.secureTextEntry).toBe(false);
    fireEvent.press(getByTestId("toggle-password"));
    expect(getByTestId("password-input").props.secureTextEntry).toBe(true);
  });

  it("names the reveal control for what pressing it will do", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} />);
    expect(getByTestId("toggle-password").props.accessibilityLabel).toBe("Show password");
    fireEvent.press(getByTestId("toggle-password"));
    expect(getByTestId("toggle-password").props.accessibilityLabel).toBe("Hide password");
  });

  it("greets a returning member, and switches the heading in create-account mode", () => {
    const { getByTestId } = render(<EmailAuthScreen {...props()} />);
    expect(getByTestId("auth-heading").props.children).toBe("Welcome back");
    fireEvent.press(getByTestId("toggle-mode"));
    expect(getByTestId("auth-heading").props.children).toBe("Create your account");
  });
});
