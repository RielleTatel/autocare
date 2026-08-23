import * as Network from "expo-network";
import { api } from "../api";
import { SqliteOutboxRepo } from "../db/outbox.repo";
import { SyncProcessor } from "./processor";
import { SqlitePhotoUploader } from "./photos";
import type { SyncBatchResult, SyncTransport } from "./types";

const transport: SyncTransport = {
  async syncBatch(items) {
    const res = await api.post<{ results: SyncBatchResult[] }>("/sync/batch", { items });
    return res.results;
  },
};

export const outbox = new SqliteOutboxRepo();
export const syncProcessor = new SyncProcessor({ outbox, transport, photos: new SqlitePhotoUploader() });

let started = false;
/** Call once at app start: drains on launch and whenever connectivity returns. */
export function startSyncListener(): void {
  if (started) return;
  started = true;
  void syncProcessor.drain().catch(() => undefined);
  Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void syncProcessor.drain().catch(() => undefined);
    }
  });
}
