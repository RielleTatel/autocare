import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type {
  RoadsideDispatchInput,
  RoadsideRequestView,
  RoadsideResponder,
  RoadsideStatus,
} from "@autocare/contracts";
import { roadsideApi } from "./roadsideApi";
import { RoadsideBoardScreen } from "./RoadsideBoardScreen";
import { RoadsideResponseScreen } from "./RoadsideResponseScreen";

/**
 * FR-036 asks that on-duty advisors know about a new call within 30 seconds.
 * Push would do that properly; there is no notifications module in this repo,
 * so the queue re-reads itself on the same 15 s cadence the member's status
 * screen uses. It closes the gap only while the screen is open — see the
 * roadside spec's "Not covered".
 */
export const ROADSIDE_BOARD_POLL_MS = 15_000;

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
  const [responders, setResponders] = useState<RoadsideResponder[]>([]);
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

  // On focus, not just on mount: coming back from a call must not leave the
  // advisor looking at the queue as it was before they opened it.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The driver list changes far more slowly than the queue, so it is fetched
  // once and never polled. A failure here is survivable — the form falls back
  // to a typed name, which is also the tow-partner path.
  useEffect(() => {
    void roadsideApi
      .responders()
      .then(setResponders)
      .catch(() => setResponders([]));
  }, []);

  // Poll only while the queue itself is on screen. Behind an open call it would
  // burn battery and could swap the list out mid-update.
  const openIdRef = useRef<string | null>(null);
  openIdRef.current = openId;
  useEffect(() => {
    if (openId) return;
    const timer = setInterval(() => {
      if (!openIdRef.current) void load();
    }, ROADSIDE_BOARD_POLL_MS);
    return () => clearInterval(timer);
  }, [openId, load]);

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
      responders={responders}
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
