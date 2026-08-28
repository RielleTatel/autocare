import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

const nav = [
  { label: "Schedule", href: "/staff/schedule" },
  { label: "Work orders", href: "/staff/work-orders" },
  { label: "Admin", href: "/admin" },
];

describe("TopBar", () => {
  it("shows the brand and which console you are in", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} onSignOut={() => {}} />);
    expect(screen.getByText("AutoCare+")).toBeTruthy();
    expect(screen.getByText("advisor desk")).toBeTruthy();
  });

  it("renders every nav destination as a link", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} onSignOut={() => {}} />);
    expect(screen.getByRole("link", { name: "Schedule" }).getAttribute("href")).toBe("/staff/schedule");
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
  });

  it("marks the active destination for assistive tech, not just visually", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} active="Schedule" onSignOut={() => {}} />);
    expect(screen.getByRole("link", { name: "Schedule" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("aria-current")).toBeNull();
  });

  it("signs out", () => {
    const onSignOut = vi.fn();
    render(<TopBar consoleLabel="admin console" nav={nav} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
