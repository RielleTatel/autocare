import { render, screen, waitFor } from "@testing-library/react-native";
import { SyncQueueScreen } from "./SyncQueueScreen";
import { outbox } from "../../shared/sync";

jest.mock("../../shared/sync", () => ({
  outbox: { pendingInOrder: jest.fn(), rejectedInOrder: jest.fn() },
  syncProcessor: { subscribe: jest.fn(() => () => {}), drain: jest.fn(), snapshot: jest.fn().mockResolvedValue({ pendingCount: 1, rejectedCount: 0, lastSyncAt: null, isDraining: false }) },
}));

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
});
