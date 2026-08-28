import { render, screen, waitFor } from "@testing-library/react-native";

jest.mock("../../shared/sync", () => ({
  syncProcessor: { subscribe: jest.fn(() => () => {}), snapshot: jest.fn().mockResolvedValue({ pendingCount: 0, rejectedCount: 0, lastSyncAt: null, isDraining: false }) },
}));
jest.mock("../../shared/sync/useSyncStatus", () => ({
  useSyncStatus: () => ({ pendingCount: 0, rejectedCount: 0, lastSyncAt: null, isDraining: false }),
}));

import { TaskListScreen } from "./TaskListScreen";
import * as tasksApi from "./tasksApi";

jest.mock("./tasksApi");
const mocked = tasksApi as jest.Mocked<typeof tasksApi>;

const task = {
  id: "a1",
  scheduledStart: "2026-08-28T01:00:00.000Z", // 09:00 Manila
  vehiclePlateNo: "ABC 1234",
  serviceTypeName: "Preventive maintenance",
  memberName: "R. Tatel",
  status: "IN_PROGRESS",
};

const props = { name: "J. Cruz", role: "MECHANIC", onStartInspection: jest.fn(), onOpenSyncQueue: jest.fn() };

describe("TaskListScreen", () => {
  it("lists today's work with its plate, service and Manila start time", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [task], stale: false });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText("Preventive maintenance")).toBeTruthy());
    expect(screen.getByText("ABC 1234")).toBeTruthy();
    expect(screen.getByText("09:00")).toBeTruthy();
    expect(screen.getByText("IN PROGRESS")).toBeTruthy();
  });

  it("says the day is clear rather than showing an empty screen", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [], stale: false });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText("Nothing booked today")).toBeTruthy());
  });

  it("marks a cached list as last-known when offline", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [task], stale: true });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText(/Showing the last list downloaded/)).toBeTruthy());
  });

  it("offers a retry when there is nothing cached to fall back on", async () => {
    mocked.getTodaysTasks.mockRejectedValue(new Error("offline"));
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByLabelText("Try again")).toBeTruthy());
  });
});
