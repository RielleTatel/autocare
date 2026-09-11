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
// Mutable so a test can put work in the queue; reset in beforeEach below.
const syncStatus = { pendingCount: 0, rejectedCount: 0, lastSyncAt: null, isDraining: false };
jest.mock("../../shared/sync/useSyncStatus", () => ({
  useSyncStatus: () => syncStatus,
}));

import { TaskListScreen } from "./TaskListScreen";
import * as tasksApi from "./tasksApi";

jest.mock("./tasksApi");
const mocked = tasksApi as jest.Mocked<typeof tasksApi>;

const task = {
  id: "a1",
  scheduledStart: "2026-08-28T01:00:00.000Z", // 09:00 Manila
  vehicleId: "veh-1",
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

  it("opens a tapped task with both the vehicle and the booking it belongs to", async () => {
    // The handoff that closes the loop: vehicleId skips the plate search, and
    // appointmentId is what later lets the synced inspection complete the booking.
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [task], stale: false });
    const onStartInspection = jest.fn();
    render(<TaskListScreen {...props} onStartInspection={onStartInspection} />);

    fireEvent.press(await screen.findByLabelText("Open Preventive maintenance for ABC 1234"));

    expect(onStartInspection).toHaveBeenCalledWith({ vehicleId: "veh-1", appointmentId: "a1" });
  });

  it("starts a walk-in with no booking context", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [], stale: false });
    const onStartInspection = jest.fn();
    render(<TaskListScreen {...props} onStartInspection={onStartInspection} />);

    fireEvent.press(await screen.findByText("Start inspection"));

    // No argument: the technician picks the vehicle by plate, and there is no
    // appointment to complete.
    expect(onStartInspection).toHaveBeenCalledWith();
  });

  it("shows a completed booking as done", async () => {
    // Previously impossible: nothing in the system ever wrote COMPLETED.
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [{ ...task, status: "COMPLETED" }], stale: false });
    render(<TaskListScreen {...props} />);

    expect(await screen.findByText("COMPLETED")).toBeTruthy();
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

describe("TaskListScreen sign out", () => {
  afterEach(() => {
    syncStatus.pendingCount = 0;
  });

  it("offers a way out of the app", async () => {
    render(<TaskListScreen name="Ka Tono" role="MECHANIC" onLogout={jest.fn()} />);
    expect(await screen.findByTestId("staff-logout")).toBeTruthy();
  });

  // A shift's worth of queued inspections sits behind this button. One stray
  // tap must not end the session.
  it("asks before signing out", async () => {
    const onLogout = jest.fn();
    render(<TaskListScreen name="Ka Tono" role="MECHANIC" onLogout={onLogout} />);
    fireEvent.press(await screen.findByTestId("staff-logout"));
    expect(onLogout).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("staff-logout-confirm"));
    expect(onLogout).toHaveBeenCalled();
  });

  it("lets the technician back out of signing out", async () => {
    const onLogout = jest.fn();
    render(<TaskListScreen name="Ka Tono" role="MECHANIC" onLogout={onLogout} />);
    fireEvent.press(await screen.findByTestId("staff-logout"));
    fireEvent.press(screen.getByTestId("staff-logout-cancel"));
    expect(screen.queryByTestId("staff-logout-confirm")).toBeNull();
    expect(onLogout).not.toHaveBeenCalled();
  });

  // Unsynced work is invisible once the token is gone, so the warning has to
  // name it before the decision, not after.
  it("warns when sync work would be stranded", async () => {
    syncStatus.pendingCount = 3;
    render(<TaskListScreen name="Ka Tono" role="MECHANIC" onLogout={jest.fn()} />);
    fireEvent.press(await screen.findByTestId("staff-logout"));
    expect(screen.getByTestId("staff-logout-pending-warning")).toBeTruthy();
  });
});
