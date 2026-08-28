import { render, screen } from "@testing-library/react-native";
import { StatusChip, statusColor, STATUS_LABELS } from "./StatusChip";
import { vhsBands } from "@autocare/design-tokens";

describe("StatusChip", () => {
  it("renders the human label, not the enum", () => {
    render(<StatusChip status="NOT_APPLICABLE" />);
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(STATUS_LABELS.ATTENTION).toBe("Attention");
  });

  it("keeps CRITICAL and ATTENTION visually distinct — they are product data", () => {
    expect(statusColor("CRITICAL")).toBe(vhsBands.CRITICAL.fill);
    expect(statusColor("ATTENTION")).toBe(vhsBands.NEEDS_ATTENTION.fill);
    expect(statusColor("CRITICAL")).not.toBe(statusColor("ATTENTION"));
  });

  it("forwards a testID so screens can assert the derived status", () => {
    render(<StatusChip status="GOOD" testID="derived-status-chip" />);
    expect(screen.getByTestId("derived-status-chip")).toHaveTextContent("Good");
  });
});
