import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getBays = vi.fn();
const getOperatingHours = vi.fn();
vi.mock("../../../lib/scheduling/api", () => ({
  getBays: () => getBays(),
  getOperatingHours: () => getOperatingHours(),
}));

import { TodayPanel } from "./TodayPanel";

const appt = (over: Record<string, unknown> = {}) => ({
  id: "a1", bayId: "bay1", serviceTypeName: "Oil change",
  scheduledStart: "2026-08-28T01:00:00.000Z", scheduledEnd: "2026-08-28T02:00:00.000Z",
  status: "BOOKED", requiresPickup: false, vehiclePlateNo: "ABC 1234", memberName: "R. Tatel",
  ...over,
}) as never;

describe("TodayPanel", () => {
  beforeEach(() => {
    getBays.mockReset();
    getOperatingHours.mockReset();
    getBays.mockResolvedValue([{ id: "bay1" }, { id: "bay2" }, { id: "bay3" }]);
    getOperatingHours.mockResolvedValue([{ walkInBufferPct: 20 }]);
  });

  it("counts the day's bookings", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2" })]} />);
    await waitFor(() => expect(screen.getByText("Booked")).toBeTruthy());
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("counts bays in use against the total", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2", bayId: "bay2" })]} />);
    await waitFor(() => expect(screen.getByText("2 of 3")).toBeTruthy());
  });

  it("does not count a cancelled appointment as occupying a bay", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2", bayId: "bay2", status: "CANCELLED" })]} />);
    await waitFor(() => expect(screen.getByText("1 of 3")).toBeTruthy());
  });

  it("counts pick-ups", async () => {
    render(<TodayPanel appointments={[appt({ requiresPickup: true }), appt({ id: "a2" })]} />);
    await waitFor(() => expect(screen.getByText("Pick-ups")).toBeTruthy());
    expect(screen.getByText("1")).toBeTruthy();
  });
});
