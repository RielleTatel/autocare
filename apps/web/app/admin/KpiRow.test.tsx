import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getAnalyticsSummary = vi.fn();
vi.mock("../../lib/analytics/api", () => ({
  getAnalyticsSummary: () => getAnalyticsSummary(),
  getWasteSummary: vi.fn(),
}));

import { KpiRow } from "./KpiRow";

describe("KpiRow", () => {
  beforeEach(() => {
    getAnalyticsSummary.mockReset();
    getAnalyticsSummary.mockImplementation(() => new Promise(() => {}));
  });

  it("renders MRR as pesos, not centavos", async () => {
    getAnalyticsSummary.mockResolvedValue({ mrrCentavos: "41230000", activeMembers: 274, churn30d: 0.021, bayUtilisation: 0.78 });
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("₱412,300")).toBeTruthy());
  });

  it("renders churn and utilisation as percentages", async () => {
    getAnalyticsSummary.mockResolvedValue({ mrrCentavos: "0", activeMembers: 0, churn30d: 0.021, bayUtilisation: 0.78 });
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("2.1%")).toBeTruthy());
    expect(screen.getByText("78%")).toBeTruthy();
  });

  it("degrades to a retryable message without blanking the dashboard", async () => {
    getAnalyticsSummary.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("Could not load the numbers")).toBeTruthy());
  });
});
