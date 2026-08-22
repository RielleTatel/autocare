import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { InvoicesScreen } from "./InvoicesScreen";
import { Invoice } from "@autocare/contracts";

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "INV-0001", subscriptionId: "s1", totalCentavos: 150000, status: "PAID",
  dueDate: "2026-08-01T00:00:00Z", issuedAt: "2026-08-01T00:00:00Z", items: [], ...over,
});

describe("InvoicesScreen", () => {
  it("renders the invoice list from the fetched invoices", async () => {
    const fetchInvoices = jest.fn().mockResolvedValue([invoice(), invoice({ id: "i2", number: "INV-0002" })]);
    const { getByTestId, getByText, getAllByText } = render(<InvoicesScreen fetchInvoices={fetchInvoices} onSelectInvoice={jest.fn()} />);
    await waitFor(() => getByTestId("invoice-i1"));
    getByText("INV-0001");
    getByText("INV-0002");
    expect(getAllByText(/₱1500\.00/)).toHaveLength(2);
  });

  it("calls onSelectInvoice when a row is tapped", async () => {
    const fetchInvoices = jest.fn().mockResolvedValue([invoice()]);
    const onSelectInvoice = jest.fn();
    const { getByTestId } = render(<InvoicesScreen fetchInvoices={fetchInvoices} onSelectInvoice={onSelectInvoice} />);
    await waitFor(() => getByTestId("invoice-i1"));
    fireEvent.press(getByTestId("invoice-i1"));
    expect(onSelectInvoice).toHaveBeenCalledWith(expect.objectContaining({ id: "i1" }));
  });

  it("shows an empty state when there are no invoices", async () => {
    const fetchInvoices = jest.fn().mockResolvedValue([]);
    const { getByText } = render(<InvoicesScreen fetchInvoices={fetchInvoices} onSelectInvoice={jest.fn()} />);
    await waitFor(() => getByText(/no invoices yet/i));
  });
});
