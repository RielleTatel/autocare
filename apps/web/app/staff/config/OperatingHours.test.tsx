import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../lib/scheduling/api", () => ({
  getBays: vi.fn().mockResolvedValue([]),
  getServiceTypes: vi.fn().mockResolvedValue([]),
  getOperatingHours: vi.fn(),
  createBay: vi.fn(),
  createServiceType: vi.fn(),
  upsertOperatingHours: vi.fn(),
  // The page also renders <Shifts>; stub its calls so this suite exercises the
  // hours section rather than an incidental roster-load failure.
  getShifts: vi.fn().mockResolvedValue([]),
  getRosterableStaff: vi.fn().mockResolvedValue([]),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
}));

import CapacityConfigPage from "./page";
import { getOperatingHours } from "../../../lib/scheduling/api";

const hours = (over: Partial<Record<string, unknown>> = {}) => ({
  weekday: "MON", dateOverride: null, openTime: "09:00", closeTime: "17:00", walkInBufferPct: 10, ...over,
});

describe("capacity config — operating hours", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the hours a day is actually open", async () => {
    vi.mocked(getOperatingHours).mockResolvedValue([hours()] as never);
    render(<CapacityConfigPage />);
    await waitFor(() => expect(screen.getByText("09:00–17:00")).toBeDefined());
    expect(screen.getByText("10% walk-in buffer")).toBeDefined();
  });

  it("names a day with no row as closed rather than leaving it blank", async () => {
    vi.mocked(getOperatingHours).mockResolvedValue([hours()] as never);
    render(<CapacityConfigPage />);
    // MON is configured; the other six are not and must say so — and say what
    // it means, not just the word.
    await waitFor(() => expect(screen.getAllByText(/Closed — no bookings can be made/)).toHaveLength(6));
  });

  it("lists every weekday, not only the configured ones", async () => {
    vi.mocked(getOperatingHours).mockResolvedValue([hours()] as never);
    render(<CapacityConfigPage />);
    await waitFor(() => expect(screen.getByTestId("hours-row-MON")).toBeDefined());
    for (const w of ["TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
      expect(screen.getByTestId(`hours-row-${w}`)).toBeDefined();
    }
  });

  it("ignores one-off date overrides in the weekly schedule", async () => {
    vi.mocked(getOperatingHours).mockResolvedValue([
      hours(),
      hours({ weekday: null, dateOverride: "2026-12-25", openTime: "10:00", closeTime: "12:00" }),
    ] as never);
    render(<CapacityConfigPage />);
    await waitFor(() => expect(screen.getByText("09:00–17:00")).toBeDefined());
    expect(screen.queryByText("10:00–12:00")).toBeNull();
  });
});
