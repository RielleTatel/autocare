import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ApprovalRequestScreen } from "./ApprovalRequestScreen";
import type { WorkOrder, WorkOrderItem } from "./workOrderApi";

function item(partial: Partial<WorkOrderItem>): WorkOrderItem {
  return {
    id: "i1", type: "PART", partSku: null, partName: null, description: "x", qty: 1,
    unitPriceCentavos: 100000, discountCentavos: 0, lineTotalCentavos: 100000,
    approvalStatus: "PENDING", recommendationId: null, recommendationLabel: null, severity: null, done: false, ...partial,
  };
}

const wo: WorkOrder = {
  id: "wo1", number: "WO-202608-0001", vehicleId: "v1", status: "AWAITING_APPROVAL",
  customerComplaint: null, technicianSummary: null, openedAt: "", closedAt: null,
  items: [
    item({ id: "pad", recommendationLabel: "Front brake pads", severity: "ATTENTION", unitPriceCentavos: 155000, lineTotalCentavos: 155000 }),
    item({ id: "labor", type: "LABOR", description: "Brake labour", unitPriceCentavos: 80000, lineTotalCentavos: 80000 }),
  ],
  totals: { partsCentavos: 155000, laborCentavos: 80000, discountCentavos: 0, approvedCentavos: 0, grandTotalCentavos: 235000 },
};

describe("ApprovalRequestScreen (M-25)", () => {
  it("keeps the running approved total updated as lines are approved", () => {
    render(<ApprovalRequestScreen workOrder={wo} onSubmit={jest.fn()} />);
    expect(screen.getByTestId("approved-total")).toHaveTextContent("₱0.00");
    fireEvent.press(screen.getByLabelText("Approve Front brake pads"));
    expect(screen.getByTestId("approved-total")).toHaveTextContent("₱1,550.00");
    fireEvent.press(screen.getByLabelText("Approve Brake labour"));
    expect(screen.getByTestId("approved-total")).toHaveTextContent("₱2,350.00");
  });

  it("submit is blocked until every line is decided, then sends all decisions atomically", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ApprovalRequestScreen workOrder={wo} onSubmit={onSubmit} />);
    const confirm = screen.getByLabelText("Confirm decisions");
    expect(confirm.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText("Approve Front brake pads"));
    fireEvent.press(screen.getByLabelText("Decline Brake labour"));
    fireEvent.press(confirm);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith([
      { itemId: "pad", decision: "APPROVED" },
      { itemId: "labor", decision: "DECLINED" },
    ]);
  });

  it("a declined line contributes nothing to the approved total", () => {
    render(<ApprovalRequestScreen workOrder={wo} onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Decline Front brake pads"));
    fireEvent.press(screen.getByLabelText("Defer Brake labour"));
    expect(screen.getByTestId("approved-total")).toHaveTextContent("₱0.00");
  });
});
