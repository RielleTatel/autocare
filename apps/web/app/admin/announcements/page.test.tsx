import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementsAdminPage from "./page";

vi.mock("../../../lib/announcements/api", () => ({
  getBroadcasts: vi.fn(async () => []),
  createBroadcast: vi.fn(async () => ({ ok: true })),
  unpublishBroadcast: vi.fn(async () => ({ ok: true })),
}));

import { getBroadcasts, createBroadcast, unpublishBroadcast } from "../../../lib/announcements/api";

const row = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  title: "Holiday hours",
  body: "Closed Dec 25.",
  status: "ACTIVE" as const,
  publishedAt: "2026-09-01T00:00:00.000Z",
  expiresAt: null,
  ...over,
});

describe("AnnouncementsAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getBroadcasts as any).mockResolvedValue([]);
  });

  it("loads existing broadcasts on mount", async () => {
    (getBroadcasts as any).mockResolvedValueOnce([row()]);
    render(<AnnouncementsAdminPage />);
    expect(await screen.findByText("Holiday hours")).toBeTruthy();
  });

  it("submits a new broadcast and clears the form", async () => {
    render(<AnnouncementsAdminPage />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Typhoon closure" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Closed today." } });
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(createBroadcast).toHaveBeenCalledWith({ title: "Typhoon closure", body: "Closed today." });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
    });
  });

  it("refuses to submit an empty form and says why", async () => {
    render(<AnnouncementsAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(createBroadcast).not.toHaveBeenCalled();
  });

  it("surfaces a failed publish instead of silently clearing", async () => {
    (createBroadcast as any).mockRejectedValueOnce(new Error("admin only"));
    render(<AnnouncementsAdminPage />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("admin only");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("T");
  });

  it("offers unpublish only for an active broadcast", async () => {
    (getBroadcasts as any).mockResolvedValueOnce([row(), row({ id: "a2", title: "Old notice", status: "SUPERSEDED" })]);
    render(<AnnouncementsAdminPage />);
    await screen.findByText("Holiday hours");

    const unpublishButtons = screen.getAllByRole("button", { name: /unpublish/i });
    expect(unpublishButtons).toHaveLength(1);

    fireEvent.click(unpublishButtons[0]);
    await waitFor(() => expect(unpublishBroadcast).toHaveBeenCalledWith("a1"));
  });
});
