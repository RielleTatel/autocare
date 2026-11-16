import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./Shifts", () => ({ Shifts: () => null }));
vi.mock("../../../lib/scheduling/api", () => ({
  getBays: vi.fn().mockResolvedValue([]),
  getServiceTypes: vi.fn(),
  getOperatingHours: vi.fn().mockResolvedValue([]),
  createBay: vi.fn(), createServiceType: vi.fn(), updateServiceType: vi.fn(), upsertOperatingHours: vi.fn(),
}));
import CapacityConfigPage from "./page";
import { getServiceTypes, updateServiceType } from "../../../lib/scheduling/api";

describe("service inspection configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceTypes).mockResolvedValue([{ id: "service-1", code: "RENAMED", name: "Safety service", standardDurationMin: 60, inspectionRequired: true }]);
    vi.mocked(updateServiceType).mockResolvedValue({ id: "service-1", code: "RENAMED", name: "Safety service", standardDurationMin: 60, inspectionRequired: false });
  });
  it("edits the explicit requirement on the chosen service and refreshes", async () => {
    render(<CapacityConfigPage />);
    await screen.findByText("Safety service");
    const setting = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    expect(setting.checked).toBe(true);
    fireEvent.click(setting);
    await waitFor(() => expect(updateServiceType).toHaveBeenCalledWith("service-1", { inspectionRequired: false }));
    await screen.findByText("Inspection requirement saved");
    expect(getServiceTypes).toHaveBeenCalledTimes(2);
  });
  it("shows a failed save and preserves the server setting", async () => {
    vi.mocked(updateServiceType).mockRejectedValueOnce(new Error("Only advisors may manage services"));
    render(<CapacityConfigPage />);
    await screen.findByText("Safety service");
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await screen.findByText("Only advisors may manage services");
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
  });
});
