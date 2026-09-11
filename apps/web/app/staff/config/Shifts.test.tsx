import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../lib/scheduling/api", () => ({
  getShifts: vi.fn(),
  getRosterableStaff: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
}));

import { Shifts } from "./Shifts";
import { getShifts, getRosterableStaff, createShift, updateShift, deleteShift } from "../../../lib/scheduling/api";

const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const shift = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "s1",
  date: tomorrow,
  startTime: "09:00",
  endTime: "18:00",
  skills: ["GENERAL"],
  userId: "u1",
  userName: "Juan Cruz",
  userEmail: "juan@example.com",
  userRole: "MECHANIC",
  ...over,
});

const staff = [{ id: "u1", name: "Juan Cruz", role: "MECHANIC" }];
const noop = () => undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRosterableStaff).mockResolvedValue(staff as never);
  vi.mocked(getShifts).mockResolvedValue([shift()] as never);
});

describe("Shifts", () => {
  it("shows who is rostered and when, in 12-hour time", async () => {
    render(<Shifts onError={noop} onMessage={noop} />);

    expect(await screen.findByText("Juan Cruz")).toBeDefined();
    expect(screen.getByText("9:00 AM–6:00 PM")).toBeDefined();
  });

  it("explains that an empty roster means nothing can be booked", async () => {
    // The failure mode this guards: hours are open, nobody is on shift, and the
    // booking screen silently offers nothing.
    vi.mocked(getShifts).mockResolvedValue([] as never);
    render(<Shifts onError={noop} onMessage={noop} />);

    expect(await screen.findByText(/Nobody is rostered/)).toBeDefined();
  });

  it("states that opening hours alone do not create capacity", async () => {
    render(<Shifts onError={noop} onMessage={noop} />);

    expect(await screen.findByText(/extending opening hours without extending a shift/i)).toBeDefined();
  });

  it("adds a shift for the selected person", async () => {
    vi.mocked(createShift).mockResolvedValue(shift() as never);
    render(<Shifts onError={noop} onMessage={noop} />);
    await screen.findByText("Juan Cruz");

    fireEvent.click(screen.getByRole("button", { name: "Add shift" }));

    await waitFor(() =>
      expect(createShift).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", startTime: "09:00", endTime: "18:00" })),
    );
  });

  it("extends a shift's end time — the lever that moves the last bookable slot", async () => {
    vi.mocked(updateShift).mockResolvedValue(shift({ endTime: "21:00" }) as never);
    render(<Shifts onError={noop} onMessage={noop} />);

    fireEvent.click(await screen.findByLabelText(/Edit shift for Juan Cruz/));
    fireEvent.change(screen.getByLabelText("Shift end"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateShift).toHaveBeenCalledWith("s1", { startTime: "09:00", endTime: "21:00" }));
  });

  it("removes a shift", async () => {
    vi.mocked(deleteShift).mockResolvedValue({ deleted: true } as never);
    render(<Shifts onError={noop} onMessage={noop} />);

    fireEvent.click(await screen.findByLabelText(/Remove shift for Juan Cruz/));

    await waitFor(() => expect(deleteShift).toHaveBeenCalledWith("s1"));
  });

  it("surfaces a rejected shift rather than failing quietly", async () => {
    vi.mocked(createShift).mockRejectedValue(new Error("shift must end after it starts"));
    const onError = vi.fn();
    render(<Shifts onError={onError} onMessage={noop} />);
    await screen.findByText("Juan Cruz");

    fireEvent.click(screen.getByRole("button", { name: "Add shift" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("shift must end after it starts"));
  });

  it("disables adding when there is no staff to roster", async () => {
    vi.mocked(getRosterableStaff).mockResolvedValue([] as never);
    vi.mocked(getShifts).mockResolvedValue([] as never);
    render(<Shifts onError={noop} onMessage={noop} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Add shift" })).toHaveProperty("disabled", true));
  });
});
