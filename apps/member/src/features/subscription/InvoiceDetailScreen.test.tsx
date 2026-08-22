import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { InvoiceDetailScreen } from "./InvoiceDetailScreen";
import { Invoice } from "@autocare/contracts";

const invoice: Invoice = {
  id: "i1", number: "INV-0001", subscriptionId: "s1", totalCentavos: 150000, status: "PAID",
  dueDate: "2026-08-01T00:00:00Z", issuedAt: "2026-08-01T00:00:00Z",
  items: [{ id: "it1", description: "Basic (MONTHLY)", qty: 1, unitPriceCentavos: 150000, taxCentavos: 0 }],
};

describe("InvoiceDetailScreen", () => {
  it("renders items and total", () => {
    const { getByTestId, getByText } = render(<InvoiceDetailScreen invoice={invoice} onDownloadReceipt={jest.fn()} />);
    getByText("Basic (MONTHLY)");
    expect(getByTestId("invoice-total").props.children).toBe("₱1500.00");
  });

  it("calls onDownloadReceipt when the download button is pressed", async () => {
    const onDownloadReceipt = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<InvoiceDetailScreen invoice={invoice} onDownloadReceipt={onDownloadReceipt} />);
    fireEvent.press(getByTestId("download-receipt"));
    await waitFor(() => expect(onDownloadReceipt).toHaveBeenCalled());
  });

  it("shows an error if the download fails", async () => {
    const onDownloadReceipt = jest.fn().mockRejectedValue(new Error("nope"));
    const { getByTestId } = render(<InvoiceDetailScreen invoice={invoice} onDownloadReceipt={onDownloadReceipt} />);
    fireEvent.press(getByTestId("download-receipt"));
    await waitFor(() => getByTestId("download-error"));
  });
});
