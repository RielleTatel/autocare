import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getHealthScore = vi.fn();
vi.mock("../../../lib/inspections/api", () => ({ getHealthScore: (...a: unknown[]) => getHealthScore(...a) }));

import { HealthScorePanel } from "./[id]/HealthScorePanel";

describe("HealthScorePanel", () => {
  // Reset calls, then restore a never-settling default. A bare mockReset leaves
  // the mock returning undefined (the panel then calls .then on it), and leaving
  // a rejecting implementation in place lets it leak into the next test.
  beforeEach(() => {
    getHealthScore.mockReset();
    getHealthScore.mockImplementation(() => new Promise(() => {}));
  });

  it("shows the score, its band and each category", async () => {
    getHealthScore.mockResolvedValue({
      score: 69,
      band: "FAIR",
      categoryScores: [
        { categoryCode: "BRK", label: "Brakes", score: 55 },
        { categoryCode: "ENG", label: "Engine", score: 91 },
      ],
    });
    render(<HealthScorePanel vehicleId="v1" />);
    await waitFor(() => expect(screen.getByText("69")).toBeTruthy());
    expect(screen.getByText("Fair")).toBeTruthy();
    expect(screen.getByText("Brakes")).toBeTruthy();
    expect(screen.getByText("Engine")).toBeTruthy();
  });

  it("says so plainly when a vehicle has never been inspected", async () => {
    // Build the rejection at call time — mockRejectedValue creates the rejected
    // promise eagerly, which surfaces as an unhandled rejection before the
    // component's catch is attached.
    getHealthScore.mockImplementation(() => Promise.reject(new Error("no health score yet for this vehicle")));
    render(<HealthScorePanel vehicleId="v1" />);
    await waitFor(() => expect(screen.getByText("No health score yet")).toBeTruthy());
  });

  it("renders nothing without a vehicle rather than fetching", () => {
    const { container } = render(<HealthScorePanel vehicleId={null} />);
    expect(container.firstChild).toBeNull();
    expect(getHealthScore).not.toHaveBeenCalled();
  });
});
