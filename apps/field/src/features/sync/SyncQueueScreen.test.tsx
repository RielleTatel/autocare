import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SyncQueueScreen } from "./SyncQueueScreen";
import { outbox, syncProcessor } from "../../shared/sync";
import { discardRejected } from "./discard";

jest.mock("../../shared/sync", () => ({
  outbox: { pendingInOrder: jest.fn(), rejectedInOrder: jest.fn(), retry: jest.fn().mockResolvedValue(undefined) },
  syncProcessor: { subscribe: jest.fn(() => () => {}), drain: jest.fn().mockResolvedValue({}), refreshStatus: jest.fn().mockResolvedValue(undefined), snapshot: jest.fn().mockResolvedValue({ pendingCount: 1, rejectedCount: 0, lastSyncAt: null, isDraining: false }) },
}));
jest.mock("./discard", () => ({ discardRejected: jest.fn().mockResolvedValue(undefined) }));

jest.mock("../../shared/sync/useSyncStatus", () => ({
  useSyncStatus: () => ({ pendingCount: 1, rejectedCount: 0, isDraining: false, lastSyncAt: null }),
}));

describe("SyncQueueScreen", () => {
  it("shows each queued item with its state", async () => {
    (outbox.pendingInOrder as jest.Mock).mockResolvedValue([
      { clientUuid: "u1", entityType: "inspection", op: "create", createdAt: Date.now(), attempts: 0 },
    ]);
    (outbox.rejectedInOrder as jest.Mock).mockResolvedValue([]);
    render(<SyncQueueScreen />);
    await waitFor(() => expect(screen.getByText("Queued")).toBeTruthy());
  });

  it("reports an empty queue as a settled state, not a blank screen", async () => {
    (outbox.pendingInOrder as jest.Mock).mockResolvedValue([]);
    (outbox.rejectedInOrder as jest.Mock).mockResolvedValue([]);
    render(<SyncQueueScreen />);
    await waitFor(() => expect(screen.getByText("Everything is synced")).toBeTruthy());
  });

  describe("a rejected item", () => {
    const rejectedEntry = {
      clientUuid: "u-rej",
      entityType: "inspection",
      op: "create",
      createdAt: Date.now(),
      attempts: 1,
      state: "REJECTED",
      lastError: "CHECKLIST_INVALID: unknown checklist version",
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      (outbox.pendingInOrder as jest.Mock).mockResolvedValue([]);
      (outbox.rejectedInOrder as jest.Mock).mockResolvedValue([rejectedEntry]);
    });

    const expand = async () => {
      render(<SyncQueueScreen />);
      const card = await screen.findByLabelText("Inspection rejected by server");
      fireEvent.press(card);
    };

    it("expands to the server's error so the failure is diagnosable", async () => {
      await expand();
      expect(await screen.findByText(/CHECKLIST_INVALID/)).toBeTruthy();
    });

    it("offers explicit discard alongside retry without deleting work automatically", async () => {
      await expand();
      expect(screen.queryByLabelText("Discard Inspection")).toBeNull();
      fireEvent.press(screen.getByLabelText("More options"));
      expect(screen.getByLabelText("Discard Inspection")).toBeTruthy();
    });

    it("retries the same rejected record then forces delivery past network backoff", async () => {
      await expand();
      fireEvent.press(await screen.findByLabelText("Retry Inspection"));
      await waitFor(() => expect(outbox.retry).toHaveBeenCalledWith("u-rej"));
      await waitFor(() => expect(syncProcessor.drain).toHaveBeenCalledWith({ force: true }));
      expect(discardRejected).not.toHaveBeenCalled();
    });

    it("confirms before discarding — the local inspection is destroyed with it", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
      await expand();
      fireEvent.press(screen.getByLabelText("More options"));
      fireEvent.press(screen.getByLabelText("Discard Inspection"));

      expect(alertSpy).toHaveBeenCalled();
      // Nothing is destroyed until the technician actually confirms.
      expect(discardRejected).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("discards the entry once the confirmation is accepted", async () => {
      // Auto-press the destructive button in the alert.
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.style === "destructive")?.onPress?.();
      });
      await expand();
      fireEvent.press(screen.getByLabelText("More options"));
      fireEvent.press(screen.getByLabelText("Discard Inspection"));

      await waitFor(() => expect(discardRejected).toHaveBeenCalledWith(expect.objectContaining({ clientUuid: "u-rej" })));
      alertSpy.mockRestore();
    });
  });
});
