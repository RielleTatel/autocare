import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockEnqueue = jest.fn().mockResolvedValue(undefined);
const mockDrain = jest.fn().mockResolvedValue({});
jest.mock("../../shared/sync", () => ({
  outbox: { enqueue: (...a: unknown[]) => mockEnqueue(...a) },
  syncProcessor: { drain: () => mockDrain() },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-waste-1" }));

import { WasteEntryScreen } from "./WasteEntryScreen";
const enqueue = mockEnqueue;

describe("WasteEntryScreen (F-10)", () => {
  beforeEach(() => enqueue.mockClear());

  it("queues a waste_record to the outbox with the selected type, quantity and unit", async () => {
    render(<WasteEntryScreen workOrderId="wo-1" workOrderNumber="WO-202608-0001" />);
    fireEvent.press(screen.getByLabelText("Coolant"));
    fireEvent.changeText(screen.getByLabelText("Quantity"), "2.5");
    fireEvent.press(screen.getByLabelText("Queue waste record"));

    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "waste_record",
      op: "create",
      payload: expect.objectContaining({ workOrderId: "wo-1", wasteType: "COOLANT", quantity: 2.5, unit: "L" }),
    }));
  });

  it("chips render at gloved-target height and the save button blocks empty quantities", () => {
    render(<WasteEntryScreen workOrderId="wo-1" />);
    expect(screen.getByLabelText("Used oil").props.style.minHeight).toBeGreaterThanOrEqual(56);
    fireEvent.press(screen.getByLabelText("Queue waste record"));
    expect(enqueue).not.toHaveBeenCalled();
  });
});
