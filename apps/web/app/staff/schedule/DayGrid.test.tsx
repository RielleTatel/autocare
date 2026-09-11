import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayGrid } from "./DayGrid";
import type { BoardAppointment, Bay, Slot } from "../../../lib/scheduling/api";

const bays: Bay[] = [
  { id: "bay1", name: "Bay 1", capabilities: ["OIL"], isActive: true },
  { id: "bay2", name: "Bay 2", capabilities: ["OIL"], isActive: true },
];

const appt = (over: Partial<BoardAppointment> = {}): BoardAppointment => ({
  id: "a1",
  bayId: "bay1",
  serviceTypeId: "st1",
  serviceTypeName: "Oil Change",
  scheduledStart: "2027-09-01T09:00:00+08:00",
  scheduledEnd: "2027-09-01T10:00:00+08:00",
  status: "BOOKED",
  requiresPickup: false,
  vehiclePlateNo: "ABC1234",
  memberName: "Jane Cruz",
  ...over,
});

const slot = (over: Partial<Slot> = {}): Slot => ({
  start: "2027-09-01T10:00:00+08:00",
  end: "2027-09-01T11:00:00+08:00",
  bayId: "bay2",
  serviceTypeId: "st1",
  ...over,
});

describe("DayGrid", () => {
  it("says there are no bays configured rather than rendering an empty grid", () => {
    render(<DayGrid bays={[]} appointments={[]} slots={[]} />);
    expect(screen.getByText(/no active bays/i)).toBeDefined();
  });

  it("prompts to pick a service type when there is nothing booked and no slots computed yet", () => {
    render(<DayGrid bays={bays} appointments={[]} slots={[]} />);
    expect(screen.getByText(/pick a service type/i)).toBeDefined();
  });

  it("renders one column per active bay", () => {
    render(<DayGrid bays={bays} appointments={[appt()]} slots={[]} />);
    expect(screen.getByText("Bay 1")).toBeDefined();
    expect(screen.getByText("Bay 2")).toBeDefined();
  });

  it("renders a booked cell with plate and status in its bay/time row", () => {
    render(<DayGrid bays={bays} appointments={[appt()]} slots={[]} />);
    expect(screen.getByText("ABC1234")).toBeDefined();
    expect(screen.getByText("BOOKED")).toBeDefined();
    expect(screen.getByText("9:00 AM")).toBeDefined();
  });

  it("renders an open cell labelled with the selected service once slots are available", () => {
    render(<DayGrid bays={bays} appointments={[]} slots={[slot()]} selectedServiceTypeName="Oil Change" />);
    expect(screen.getByText(/open/i)).toBeDefined();
    expect(screen.getByText("Oil Change")).toBeDefined();
    expect(screen.getByText("10:00 AM")).toBeDefined();
  });

  it("shows booked and open side by side without duplicating a shared row time", () => {
    render(
      <DayGrid
        bays={bays}
        appointments={[appt({ scheduledStart: "2027-09-01T10:00:00+08:00", scheduledEnd: "2027-09-01T11:00:00+08:00" })]}
        slots={[slot()]}
        selectedServiceTypeName="Oil Change"
      />,
    );
    expect(screen.getAllByText("10:00 AM")).toHaveLength(1);
    expect(screen.getByText("ABC1234")).toBeDefined();
    expect(screen.getByText(/open/i)).toBeDefined();
  });

  it("calls onCancel for a cancellable appointment but hides cancel on a cancelled one", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<DayGrid bays={bays} appointments={[appt()]} slots={[]} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledWith("a1");

    rerender(<DayGrid bays={bays} appointments={[appt({ status: "CANCELLED" })]} slots={[]} onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });
});
