import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SyncQueueScreen } from "./SyncQueueScreen";
import { outbox } from "../../shared/sync";
import { discardRejected } from "./discard";

jest.mock("../../shared/sync", () => ({
  outbox: { pendingInOrder: jest.fn(), rejectedInOrder: jest.fn() },
  syncProcessor: { subscribe: jest.fn(() => () => {}), drain: jest.fn(), snapshot: jest.fn().mockResolvedValue({ pendingCount: 1, rejectedCount: 0, lastSyncAt: null, isDraining: false }) },
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
    await waitFor(() => expect(screen.getByText("QUEUED")).toBeTruthy());
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

    it("offers Discard, since a rejected item can never be retried into success", async () => {
      await expand();
      expect(await screen.findByLabelText("Discard Inspection")).toBeTruthy();
    });

    it("confirms before discarding — the local inspection is destroyed with it", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
      await expand();
      fireEvent.press(await screen.findByLabelText("Discard Inspection"));

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
      fireEvent.press(await screen.findByLabelText("Discard Inspection"));

      await waitFor(() => expect(discardRejected).toHaveBeenCalledWith(expect.objectContaining({ clientUuid: "u-rej" })));
      alertSpy.mockRestore();
    });
  });
});
