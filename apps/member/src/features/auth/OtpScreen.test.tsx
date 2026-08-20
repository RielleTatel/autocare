import { act, fireEvent, render } from "@testing-library/react-native";
import { OtpScreen } from "./OtpScreen";

describe("OtpScreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("resend is locked for 60 s then enabled", () => {
    const { getByTestId } = render(<OtpScreen phone="+639171234567" onConfirm={jest.fn()} onResend={jest.fn()} />);
    expect(getByTestId("resend").props.accessibilityState.disabled).toBe(true);
    act(() => jest.advanceTimersByTime(60_000));
    expect(getByTestId("resend").props.accessibilityState.disabled).toBe(false);
  });
  it("submits when 6 digits entered", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(<OtpScreen phone="+639171234567" onConfirm={onConfirm} onResend={jest.fn()} />);
    fireEvent.changeText(getByTestId("otp-input"), "123456");
    expect(onConfirm).toHaveBeenCalledWith("123456");
  });
  it("shows an error message when confirm rejects (wrong code)", () => {
    const { getByTestId, queryByTestId } = render(
      <OtpScreen phone="+639171234567" onConfirm={jest.fn()} onResend={jest.fn()}
        error="That code didn't work, try again." />
    );
    expect(queryByTestId("error")).not.toBeNull();
    expect(getByTestId("error").props.children).toBe("That code didn't work, try again.");
  });
});
