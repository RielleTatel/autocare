import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./Board";
import type { BoardAppointment } from "../../../lib/scheduling/api";

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

describe("advisor board", () => {
  it("shows an empty state with no appointments", () => {
    render(<Board appointments={[]} />);
    expect(screen.getByText(/no appointments/i)).toBeDefined();
  });

  it("renders appointment cards with plate, service, status, and Manila time", () => {
    render(<Board appointments={[appt()]} />);
    expect(screen.getByText("ABC1234")).toBeDefined();
    expect(screen.getByText("Oil Change")).toBeDefined();
    expect(screen.getByText("BOOKED")).toBeDefined();
    expect(screen.getByText(/9:00 AM–10:00 AM/)).toBeDefined();
    expect(screen.getByText(/Jane Cruz/)).toBeDefined();
  });

  it("groups appointments under their start hour", () => {
    render(<Board appointments={[appt({ id: "a1" }), appt({ id: "a2", scheduledStart: "2027-09-01T09:30:00+08:00", scheduledEnd: "2027-09-01T10:30:00+08:00", vehiclePlateNo: "XYZ9876" })]} />);
    // Both 09:xx → same 9 AM hour bucket header shown once
    expect(screen.getAllByText("9 AM")).toHaveLength(1);
    expect(screen.getByText("ABC1234")).toBeDefined();
    expect(screen.getByText("XYZ9876")).toBeDefined();
  });

  it("calls onCancel for a cancellable appointment but hides cancel on a cancelled one", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<Board appointments={[appt()]} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledWith("a1");

    rerender(<Board appointments={[appt({ status: "CANCELLED" })]} onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });
});
