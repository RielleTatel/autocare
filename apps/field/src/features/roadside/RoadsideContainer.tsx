import { useCallback, useEffect, useState } from "react";
import type { RoadsideDispatchInput, RoadsideRequestView, RoadsideStatus } from "@autocare/contracts";
import { roadsideApi } from "./roadsideApi";
import { RoadsideBoardScreen } from "./RoadsideBoardScreen";
import { RoadsideResponseScreen } from "./RoadsideResponseScreen";

/** Roles that dispatch rather than respond — they land on the queue (F-18). */
const DISPATCHERS = new Set(["ADVISOR", "ADMIN"]);

/**
 * Owns the roadside API calls for the field app and decides which of the two
 * screens a given member of staff should see first.
 *
 * A driver with a call already assigned to them goes straight to it: hunting
 * for your own incident in a shared queue is the wrong first task on a
 * roadside. Everyone else starts on the queue.
 */
export function RoadsideContainer({
  userId, role, onBack,
}: {
  userId: string;
  role: string;
  onBack?: () => void;
}) {
  const [requests, setRequests] = useState<RoadsideRequestView[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await roadsideApi.board();
      setRequests(rows);
      // Only auto-open on first load; re-opening after the driver backs out
      // would trap them on the call they just left.
      setOpenId((cur) => cur ?? (DISPATCHERS.has(role) ? null : rows.find((r) => r.dispatchedToUserId === userId)?.id ?? null));
    } catch (e) {
      setError(message(e, "Could not load the roadside queue."));
    } finally {
      setLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Replace one row in place — the board and the open call read the same list. */
  const merge = (next: RoadsideRequestView) =>
    setRequests((cur) => cur.map((r) => (r.id === next.id ? next : r)));

  const run = async (fn: () => Promise<RoadsideRequestView>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      merge(await fn());
    } catch (e) {
      setError(message(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  const open = openId ? requests.find((r) => r.id === openId) ?? null : null;

  if (open) {
    return (
      <RoadsideResponseScreen
        request={open}
        busy={busy}
        error={error}
        onSetStatus={(status: RoadsideStatus) =>
          void run(() => roadsideApi.setStatus(open.id, { status }), "Could not update that call.")
        }
        onResolve={(dto) => void run(() => roadsideApi.resolve(open.id, dto), "Could not close that call.")}
        onBack={() => {
          setOpenId(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <RoadsideBoardScreen
      requests={requests}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onDispatch={(id: string, dto: RoadsideDispatchInput) =>
        void run(() => roadsideApi.dispatch(id, dto), "Could not dispatch that responder.")
      }
      onOpen={setOpenId}
      onBack={onBack}
    />
  );
}
