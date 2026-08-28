import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffShell } from "./StaffShell";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("StaffShell", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("frames its children under the masthead", () => {
    render(<StaffShell consoleLabel="advisor desk"><p>Board</p></StaffShell>);
    expect(screen.getByText("AutoCare+")).toBeTruthy();
    expect(screen.getByText("Board")).toBeTruthy();
  });

  it("ends the session and returns to login on sign out", async () => {
    render(<StaffShell consoleLabel="advisor desk"><p>Board</p></StaffShell>);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(fetch).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
  });
});
