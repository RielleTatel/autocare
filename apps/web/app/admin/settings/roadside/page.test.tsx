import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoadsideSettingsPage from "./page";

vi.mock("../../../../lib/roadside/admin-config-api", () => ({
  getRoadsideEligibilityConfig: vi.fn(),
  updateRoadsideEligibilityConfig: vi.fn(),
}));

import { getRoadsideEligibilityConfig, updateRoadsideEligibilityConfig } from "../../../../lib/roadside/admin-config-api";

describe("RoadsideSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRoadsideEligibilityConfig).mockResolvedValue({ waitingDays: 30, requireClearedPayment: true });
    vi.mocked(updateRoadsideEligibilityConfig).mockResolvedValue({ waitingDays: 0, requireClearedPayment: false });
  });

  it("loads the current roadside policy", async () => {
    render(<RoadsideSettingsPage />);
    expect(await screen.findByDisplayValue("30")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Require cleared payment" })).toBeChecked();
  });

  it("requires review and confirmation before saving a policy", async () => {
    render(<RoadsideSettingsPage />);
    const waitingDays = await screen.findByLabelText("Roadside waiting period in days");
    fireEvent.change(waitingDays, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Require cleared payment" }));
    fireEvent.change(screen.getByLabelText("Reason for roadside policy change"), { target: { value: "Launch promotion" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(screen.getByRole("note")).toHaveTextContent("available immediately");
    fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
    await waitFor(() => {
      expect(updateRoadsideEligibilityConfig).toHaveBeenCalledWith({
        waitingDays: 0,
        requireClearedPayment: false,
        reason: "Launch promotion",
      });
    });
  });

  it("does not enable review until the admin supplies an audit reason", async () => {
    render(<RoadsideSettingsPage />);
    await screen.findByDisplayValue("30");
    expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
  });
});
