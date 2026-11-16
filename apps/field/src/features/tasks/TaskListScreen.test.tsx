import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
jest.mock("@react-navigation/native", () => ({ useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]) }));
jest.mock("../../shared/sync", () => ({ syncProcessor: {} }));
jest.mock("../../shared/sync/useSyncStatus", () => ({ useSyncStatus: () => ({ lastSyncAt: null }) }));
jest.mock("./tasksApi", () => ({
  getBookings: jest.fn(),
  manilaSchedule: jest.requireActual("./tasksApi").manilaSchedule,
}));
jest.mock("../../shared/api", () => ({ API_BASE_URL: "test", api: {} }));
jest.mock("../../shared/db/kv", () => ({ kvGet: jest.fn(), kvSet: jest.fn() }));
import { TaskListScreen } from "./TaskListScreen";
import { getBookings } from "./tasksApi";
const get = getBookings as jest.Mock;
const task = { id: "a1-full-reference", vehicleId: "v1", scheduledStart: "2026-11-16T01:00:00Z", vehiclePlateNo: "ABA1234", serviceTypeName: "Full Inspection", status: "BOOKED", memberName: null };
const page = { items: [task], nextCursor: null, day: "2026-11-16", stale: false, downloadedAt: Date.now(), canInspect: true };
beforeEach(() => { get.mockReset(); get.mockResolvedValue(page); });
it("opens booking details with complete identity instead of immediately starting capture", async () => {
  const open = jest.fn(); const start = jest.fn();
  render(<TaskListScreen name="Mechanic" role="MECHANIC" onOpenBooking={open} onStartInspection={start} />);
  fireEvent.press(await screen.findByLabelText("Open Full Inspection for ABA1234"));
  expect(open).toHaveBeenCalledWith(task); expect(start).not.toHaveBeenCalled();
  expect(screen.getByText(/16 Nov 2026|Nov 16, 2026|16 Nov/)).toBeTruthy();
  expect(screen.getByText("Booked")).toBeTruthy();
});
it("changes date coverage and loads the next page without dropping the first", async () => {
  get.mockImplementation(async (bucket, cursor) => ({ ...page, items: [{ ...task, id: cursor ? "page2" : "page1", vehiclePlateNo: cursor ? "BBB5678" : "ABA1234" }], nextCursor: cursor ? null : "next" }));
  render(<TaskListScreen name="Advisor" role="ADVISOR" />);
  await screen.findByText("ABA1234");
  fireEvent.press(screen.getByLabelText("Upcoming"));
  await waitFor(() => expect(get).toHaveBeenCalledWith("upcoming", undefined));
  fireEvent.press(await screen.findByLabelText("Load more bookings"));
  expect(await screen.findByText("BBB5678")).toBeTruthy(); expect(screen.getByText("ABA1234")).toBeTruthy();
});
it("names cached date/filter/freshness and has a distinct uncached failure", async () => {
  get.mockResolvedValue({ ...page, stale: true });
  const view = render(<TaskListScreen name="Mechanic" role="MECHANIC" />);
  expect(await screen.findByText(/Offline copy: today, as of 2026-11-16/)).toBeTruthy();
  view.unmount(); get.mockRejectedValue(new Error("offline"));
  render(<TaskListScreen name="Mechanic" role="MECHANIC" />);
  expect(await screen.findByText("Could not refresh bookings")).toBeTruthy();
  expect(screen.queryByText("No today bookings")).toBeNull();
});
