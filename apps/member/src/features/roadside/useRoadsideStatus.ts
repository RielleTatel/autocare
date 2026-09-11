import { useEffect, useRef, useState } from "react";
import type { RoadsideRequestView } from "@autocare/contracts";
import { roadsideApi } from "./roadsideApi";

/**
 * The external-interface spec asks for Socket.IO with a 15 s polling fallback.
 * The socket transport does not exist in this repo yet (plan D-1), so this is
 * the fallback running as the primary. When the socket layer lands, this hook
 * is the only thing that changes.
 */
export const ROADSIDE_POLL_MS = 15_000;

const OPEN = new Set(["REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE"]);

export function useRoadsideStatus(initial: RoadsideRequestView) {
  const [request, setRequest] = useState(initial);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!OPEN.has(request.status)) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }

    timer.current = setInterval(() => {
      roadsideApi
        .byId(request.id)
        // A failed poll leaves the last known status standing: on a roadside,
        // losing signal is expected and blanking the screen would read as the
        // request having been lost.
        .then((next) => {
          setRequest(next);
          setError(false);
        })
        .catch(() => setError(true));
    }, ROADSIDE_POLL_MS);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [request.id, request.status]);

  return { request, error };
}
