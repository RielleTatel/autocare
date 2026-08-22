import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CancellationScreen } from "./CancellationScreen";

describe("CancellationScreen", () => {
  it("shows the ETF plainly and requires acceptEtf before confirming when inside lock-in", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ etfCentavos: 50000, lockInEndsAt: "2026-12-01T00:00:00Z", remainingMonths: 3 });
    const onCancel = jest.fn().mockResolvedValue({ id: "s1", status: "CANCELLED" });
    const { getByTestId } = render(<CancellationScreen fetchQuote={fetchQuote} onCancel={onCancel} onDone={jest.fn()} />);
    await waitFor(() => getByTestId("etf-summary"));
    expect(getByTestId("etf-summary").props.children).toMatch(/₱500\.00/);

    expect(getByTestId("confirm-cancel").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId("confirm-cancel")); // disabled — must not call onCancel
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("accept-etf"));
    expect(getByTestId("confirm-cancel").props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId("confirm-cancel"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(true));
  });

  it("allows cancelling immediately with no acceptance checkbox when outside lock-in", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ etfCentavos: 0, lockInEndsAt: "2025-01-01T00:00:00Z", remainingMonths: 0 });
    const onCancel = jest.fn().mockResolvedValue({ id: "s1", status: "ACTIVE" });
    const { getByTestId, queryByTestId } = render(<CancellationScreen fetchQuote={fetchQuote} onCancel={onCancel} onDone={jest.fn()} />);
    await waitFor(() => getByTestId("etf-summary"));
    expect(queryByTestId("accept-etf")).toBeNull();
    expect(getByTestId("confirm-cancel").props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByTestId("confirm-cancel"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(false));
  });

  it("shows the cancelled confirmation and calls onDone", async () => {
    const fetchQuote = jest.fn().mockResolvedValue({ etfCentavos: 0, lockInEndsAt: "2025-01-01T00:00:00Z", remainingMonths: 0 });
    const onCancel = jest.fn().mockResolvedValue({ id: "s1", status: "ACTIVE" });
    const onDone = jest.fn();
    const { getByTestId } = render(<CancellationScreen fetchQuote={fetchQuote} onCancel={onCancel} onDone={onDone} />);
    await waitFor(() => getByTestId("etf-summary"));
    fireEvent.press(getByTestId("confirm-cancel"));
    await waitFor(() => getByTestId("cancel-done"));
    fireEvent.press(getByTestId("cancel-done"));
    expect(onDone).toHaveBeenCalled();
  });
});
