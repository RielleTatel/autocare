import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getWasteSummary = vi.fn();
vi.mock("../../lib/analytics/api", () => ({
  getWasteSummary: (...a: unknown[]) => getWasteSummary(...a),
  getAnalyticsSummary: vi.fn(),
}));

import { WastePanel } from "./WastePanel";

describe("WastePanel", () => {
  beforeEach(() => {
    getWasteSummary.mockReset();
    getWasteSummary.mockImplementation(() => new Promise(() => {}));
  });

  it("summarises the quarter's records by type", async () => {
    getWasteSummary.mockResolvedValue({
      recordCount: 42,
      totals: [{ wasteType: "USED_OIL", quantity: 168, unit: "L" }, { wasteType: "FILTER", quantity: 61, unit: "pcs" }],
      lastExportedAt: "2026-06-30T00:00:00.000Z",
    });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/42 records/)).toBeTruthy());
    expect(screen.getByText(/used oil 168 L/i)).toBeTruthy();
  });

  it("says when it was last exported", async () => {
    getWasteSummary.mockResolvedValue({ recordCount: 0, totals: [], lastExportedAt: "2026-06-30T00:00:00.000Z" });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/Last export/)).toBeTruthy());
  });

  it("says so when nothing has ever been exported", async () => {
    getWasteSummary.mockResolvedValue({ recordCount: 0, totals: [], lastExportedAt: null });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/Never exported/)).toBeTruthy());
  });
});
