import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

// The screen is rendered without a NavigationContainer here, so the real
// useFocusEffect would throw. Behaviourally a focused screen runs the callback
// once on mount, which is what this stands in for.
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]),
}));

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
    expect(screen.getByText("9:00 AM")).toBeTruthy();
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

describe("TaskListScreen roadside entry (F-17/F-18)", () => {
  // Roadside is a Driver/Advisor surface. A mechanic seeing a dispatch queue
  // would be an invitation to act on calls that are not theirs.
  it("offers roadside to a driver", async () => {
    render(<TaskListScreen name="J. Cruz" role="DRIVER" onOpenRoadside={jest.fn()} />);
    expect(await screen.findByTestId("open-roadside")).toBeTruthy();
  });

  it("offers roadside to an advisor", async () => {
    render(<TaskListScreen name="A. Reyes" role="ADVISOR" onOpenRoadside={jest.fn()} />);
    expect(await screen.findByTestId("open-roadside")).toBeTruthy();
  });

  it("hides roadside from a mechanic", async () => {
    render(<TaskListScreen name="Ka Tono" role="MECHANIC" onOpenRoadside={jest.fn()} />);
    await screen.findByText(/start inspection/i);
    expect(screen.queryByTestId("open-roadside")).toBeNull();
  });

  it("opens the roadside queue when pressed", async () => {
    const onOpenRoadside = jest.fn();
    render(<TaskListScreen name="J. Cruz" role="DRIVER" onOpenRoadside={onOpenRoadside} />);
    fireEvent.press(await screen.findByTestId("open-roadside"));
    expect(onOpenRoadside).toHaveBeenCalled();
  });
});
