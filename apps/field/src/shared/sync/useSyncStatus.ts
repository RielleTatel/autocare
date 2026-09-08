import { useEffect, useState } from "react";
import type { SyncProcessor } from "./processor";
import type { SyncStatusSnapshot } from "./types";

const EMPTY: SyncStatusSnapshot = { pendingCount: 0, rejectedCount: 0, lastSyncAt: null, isDraining: false, lastError: null };

/** Live outbox status feeding the Phase 0 SyncBanner and the F-03 queue screen. */
export function useSyncStatus(processor: SyncProcessor): SyncStatusSnapshot {
  const [status, setStatus] = useState<SyncStatusSnapshot>(EMPTY);
  useEffect(() => {
    let mounted = true;
    processor.snapshot().then((s) => { if (mounted) setStatus(s); });
    const unsubscribe = processor.subscribe((s) => { if (mounted) setStatus(s); });
    return () => { mounted = false; unsubscribe(); };
  }, [processor]);
  return status;
}
