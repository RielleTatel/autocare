import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../lib/users/api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/users/api")>("../../../lib/users/api");
  return { ...actual, getStaff: vi.fn(), setUserRole: vi.fn() };
});

import StaffAdminPage from "./page";
import { getStaff, setUserRole } from "../../../lib/users/api";

const user = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "u1",
  name: "Juan Cruz",
  email: "juan@example.com",
  mobile: null,
  role: "MECHANIC",
  status: "ACTIVE",
  upcomingShifts: 0,
  ...over,
});

const chooseRole = (role: string) =>
  fireEvent.change(screen.getByLabelText(/Assign role to Juan Cruz/), { target: { value: role } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaff).mockResolvedValue([user()] as never);
});

describe("staff administration", () => {
  it("lists staff with their role", async () => {
    render(<StaffAdminPage />);

    expect(await screen.findByText("Juan Cruz")).toBeDefined();
    expect(screen.getByText("MECHANIC")).toBeDefined();
  });

  it("explains that a new hire must sign in before they can be promoted", async () => {
    // Otherwise an admin looks for someone who was never created and concludes
    // the feature is broken.
    render(<StaffAdminPage />);
    fireEvent.change(await screen.findByLabelText("Directory scope"), { target: { value: "ALL" } });

    expect(await screen.findByText(/has to sign in once on the member app/i)).toBeDefined();
  });

  it("widens the query to everyone when promoting", async () => {
    render(<StaffAdminPage />);
    fireEvent.change(await screen.findByLabelText("Directory scope"), { target: { value: "ALL" } });

    await waitFor(() => expect(getStaff).toHaveBeenCalledWith(expect.objectContaining({ scope: "ALL" })));
  });

  it("requires a reason before a role change can be confirmed", async () => {
    // The API rejects a reasonless change; the button should not let it get that far.
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");
    chooseRole("ADVISOR");

    const confirm = await screen.findByRole("button", { name: "Confirm" });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Reason for the role change"), { target: { value: "promoted to advisor" } });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveProperty("disabled", false);
  });

  it("sends the role and the reason", async () => {
    vi.mocked(setUserRole).mockResolvedValue({ ...user({ role: "ADVISOR" }), clearedShifts: 0 } as never);
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");
    chooseRole("ADVISOR");
    fireEvent.change(screen.getByLabelText("Reason for the role change"), { target: { value: "promoted to advisor" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith("u1", "ADVISOR", "promoted to advisor"));
  });

  it("warns that removing staff access cancels upcoming shifts", async () => {
    // Demoting drops rostered capacity immediately, which is easy to do by
    // accident on a busy week.
    vi.mocked(getStaff).mockResolvedValue([user({ upcomingShifts: 3 })] as never);
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");

    chooseRole("MEMBER");

    expect(await screen.findByText(/cancels 3 upcoming shifts/i)).toBeDefined();
    expect(screen.getByText(/already recorded stays attributed/i)).toBeDefined();
  });

  it("does not warn about shifts when moving between two staff roles", async () => {
    vi.mocked(getStaff).mockResolvedValue([user({ upcomingShifts: 3 })] as never);
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");

    chooseRole("ADVISOR");

    await screen.findByLabelText("Reason for the role change");
    expect(screen.queryByText(/removes their staff access/i)).toBeNull();
  });

  it("reports how many shifts were cancelled after a demotion", async () => {
    vi.mocked(getStaff).mockResolvedValue([user({ upcomingShifts: 2 })] as never);
    vi.mocked(setUserRole).mockResolvedValue({ ...user({ role: "MEMBER" }), clearedShifts: 2 } as never);
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");
    chooseRole("MEMBER");
    fireEvent.change(screen.getByLabelText("Reason for the role change"), { target: { value: "left the workshop" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/2 upcoming shift\(s\) were cancelled/i)).toBeDefined();
  });

  it("surfaces a refused change, such as demoting the last admin", async () => {
    vi.mocked(setUserRole).mockRejectedValue(new Error("Cannot demote the last active admin"));
    render(<StaffAdminPage />);
    await screen.findByText("Juan Cruz");
    chooseRole("MEMBER");
    fireEvent.change(screen.getByLabelText("Reason for the role change"), { target: { value: "attempting lockout" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Cannot demote the last active admin")).toBeDefined();
  });

  it("never offers the role the person already has", async () => {
    render(<StaffAdminPage />);
    const select = (await screen.findByLabelText(/Assign role to Juan Cruz/)) as HTMLSelectElement;

    const options = Array.from(select.options).map((o) => o.value);
    expect(options).not.toContain("MECHANIC");
    expect(options).toContain("ADVISOR");
  });
});
