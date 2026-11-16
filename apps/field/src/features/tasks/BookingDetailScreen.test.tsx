import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
jest.mock("@react-navigation/native", () => ({ useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]) }));
jest.mock("../../shared/sync", () => ({ syncProcessor: {}, outbox: { rejectedInOrder: jest.fn().mockResolvedValue([]) } }));
jest.mock("../../shared/sync/useSyncStatus", () => ({ useSyncStatus: () => ({ lastSyncAt: null }) }));
jest.mock("../../shared/db/inspections.repo", () => ({ InspectionsRepo: jest.fn().mockImplementation(() => ({ findByBooking: (...args: unknown[]) => mockFind(...args) })) }));
jest.mock("./tasksApi", () => ({ getBooking: jest.fn(), manilaSchedule: (s: string) => s }));
jest.mock("../../shared/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../history/VehicleHistory", () => ({ VehicleHistory: () => null }));
const mockFind = jest.fn();
import { api } from "../../shared/api";
const vehicle = { id: "v1", plateNo: "ABA1234", make: "Toyota", model: "Vios", year: 2022, currentOdometerKm: 40000 };
import { getBooking } from "./tasksApi";
import { BookingDetailScreen } from "./BookingDetailScreen";
const task = { id: "booking-full-id", vehicleId: "v1", vehiclePlateNo: "ABA1234", serviceTypeName: "Renamed inspection service", scheduledStart: "2026-11-17T00:00:00Z", status: "BOOKED", memberName: null, inspectionRequired: true, canInspect: true };
const props = { task, onBack: jest.fn(), onStart: jest.fn(), onOpenSyncQueue: jest.fn(), onOpenReport: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); mockFind.mockResolvedValue(null); (getBooking as jest.Mock).mockResolvedValue(task); (api.get as jest.Mock).mockResolvedValue(vehicle); });
it("uses configured eligibility for an early start and carries complete booking identity", async () => {
  render(<BookingDetailScreen {...props} />);
  await waitFor(() => expect(screen.getByLabelText("Start inspection").props.accessibilityState.disabled).toBe(false));
  fireEvent.changeText(screen.getByLabelText("Odometer reading"), "42000");
  fireEvent.press(screen.getByLabelText("Start inspection"));
  expect(props.onStart).toHaveBeenCalledWith(task, { vehicle, odometerKm: 42000 });
  expect(screen.queryByLabelText("Booking ID: booking-full-id")).toBeNull();
  fireEvent.press(screen.getByLabelText("References"));
  expect(screen.getByLabelText("Booking ID: booking-full-id")).toBeTruthy();
});
it.each([{ status: "COMPLETED" }, { status: "CANCELLED" }, { status: "NO_SHOW" }, { canInspect: false }, { inspectionRequired: false }])("does not create new work for %o", async (change) => {
  (getBooking as jest.Mock).mockResolvedValue({ ...task, ...change });
  render(<BookingDetailScreen {...props} />);
  await screen.findByText(/This booking does not allow|requires an authorized|does not require/);
  expect(screen.queryByLabelText("Start inspection")).toBeNull();
});
it("resumes saved work through a network failure and never offers a second start", async () => {
  mockFind.mockResolvedValue({ clientUuid: "draft-a", status: "DRAFT" });
  (getBooking as jest.Mock).mockRejectedValue(new Error("offline"));
  render(<BookingDetailScreen {...props} />);
  fireEvent.press(await screen.findByLabelText("Resume inspection"));
  expect(props.onStart).toHaveBeenCalledWith(task); expect(screen.queryByLabelText("Start inspection")).toBeNull();
});
it("keeps invalid odometer readings from starting an inspection", async () => {
  render(<BookingDetailScreen {...props} />);
  await waitFor(() => expect(screen.getByLabelText("Start inspection").props.accessibilityState.disabled).toBe(false));
  fireEvent.changeText(screen.getByLabelText("Odometer reading"), "-10");
  fireEvent.press(screen.getByLabelText("Start inspection"));
  expect(props.onStart).not.toHaveBeenCalled();
  expect(screen.getByText(/Enter a whole number/)).toBeTruthy();
});
it("distinguishes accepted cancelled report conflict and score calculation pending", async () => {
  (getBooking as jest.Mock).mockResolvedValue({ ...task, status: "CANCELLED", inspectionId: "inspection-server-id", scorePending: true });
  render(<BookingDetailScreen {...props} />);
  fireEvent.press(await screen.findByLabelText("View report"));
  expect(props.onOpenReport).toHaveBeenCalledWith("v1", "inspection-server-id");
  expect(screen.getByText(/ask an advisor to review the conflict/)).toBeTruthy();
  expect(screen.getByText(/score calculation is pending/)).toBeTruthy();
});
