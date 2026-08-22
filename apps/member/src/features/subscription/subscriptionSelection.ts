import { Subscription } from "@autocare/contracts";

/**
 * Picks which subscription "Manage subscription" should open for a given vehicle, out of
 * a member's full subscription list (GET /subscriptions returns all vehicles' subscriptions,
 * not scoped to one vehicle — mis-picking here would silently misroute a paying customer on
 * a multi-vehicle account).
 *
 * Rule: consider only this vehicle's non-CANCELLED subscriptions.
 *  - none → null (caller should route to plan selection / show "no active subscription")
 *  - one → that one
 *  - more than one (shouldn't normally happen — at most one ACTIVE per vehicle is enforced
 *    server-side, but GRACE/PAST_DUE/SUSPENDED rows could coexist with a lingering one) →
 *    prefer ACTIVE; otherwise the most recently started.
 */
export function selectManageableSubscription<T extends Pick<Subscription, "vehicleId" | "status" | "startedAt">>(
  subscriptions: T[],
  vehicleId: string,
): T | null {
  const candidates = subscriptions.filter((s) => s.vehicleId === vehicleId && s.status !== "CANCELLED");
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const active = candidates.filter((s) => s.status === "ACTIVE");
  const pool = active.length > 0 ? active : candidates;
  return pool.reduce((latest, s) => (new Date(s.startedAt).getTime() > new Date(latest.startedAt).getTime() ? s : latest));
}
