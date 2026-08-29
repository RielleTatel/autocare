import { fireEvent, render } from "@testing-library/react-native";
import { BookingsListScreen } from "./BookingsListScreen";
import type { MemberAppointment } from "./bookingApi";

const NOW = new Date("2026-09-01T08:00:00+08:00");

const appt = (over: Partial<MemberAppointment> = {}): MemberAppointment => ({
  id: "a1",
  vehicleId: "v1",
  serviceTypeId: "st1",
  bayId: null,
  scheduledStart: "2026-09-04T10:30:00+08:00",
  scheduledEnd: "2026-09-04T11:30:00+08:00",
  status: "CONFIRMED",
  requiresPickup: false,
  ...over,
});

const serviceNames = { st1: "General Maintenance" };
const vehicleLabels = { v1: "2020 Toyota Vios" };
const props = () => ({ serviceNames, now: NOW, onCancel: jest.fn(), onBookNew: jest.fn() });

describe("BookingsListScreen", () => {
  it("invites a first booking instead of reporting an absence", () => {
    const { getByTestId, getByText } = render(<BookingsListScreen {...props()} appointments={[]} />);
    getByTestId("bookings-empty");
    getByText("No upcoming services");
    expect(getByTestId("book-new")).toBeTruthy();
  });

  it("books from the empty state", () => {
    const p = props();
    const { getByTestId } = render(<BookingsListScreen {...p} appointments={[]} />);
    fireEvent.press(getByTestId("book-new"));
    expect(p.onBookNew).toHaveBeenCalled();
  });

  it("leads a booking with its service, then when, then which car", () => {
    const { getByTestId, getByText } = render(
      <BookingsListScreen {...props()} appointments={[appt()]} vehicleLabels={vehicleLabels} />,
    );
    getByTestId("appt-a1");
    getByText("General Maintenance");
    getByText("CONFIRMED");
    expect(getByTestId("appt-vehicle-a1").props.children).toBe("2020 Toyota Vios");
  });

  it("omits the vehicle line rather than showing a raw id when labels are unavailable", () => {
    const { queryByTestId } = render(<BookingsListScreen {...props()} appointments={[appt()]} />);
    expect(queryByTestId("appt-vehicle-a1")).toBeNull();
  });

  it("offers cancel on an upcoming booking and not on a past one", () => {
    const p = props();
    const { getByTestId, queryByTestId } = render(
      <BookingsListScreen
        {...p}
        appointments={[appt(), appt({ id: "a2", scheduledStart: "2026-08-01T10:00:00+08:00", status: "COMPLETED" })]}
      />,
    );
    fireEvent.press(getByTestId("cancel-a1"));
    expect(p.onCancel).toHaveBeenCalledWith("a1");
    expect(queryByTestId("cancel-a2")).toBeNull();
  });

  it("surfaces a work order waiting on the member", () => {
    const onApprove = jest.fn();
    const { getByTestId } = render(
      <BookingsListScreen {...props()} appointments={[appt()]} pendingApproval={{ label: "2 items need your approval", onApprove }} />,
    );
    fireEvent.press(getByTestId("pending-approval"));
    expect(onApprove).toHaveBeenCalled();
  });
});
