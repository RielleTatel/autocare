import type {
  RoadsideDispatchInput,
  RoadsideRequestView,
  RoadsideResolveInput,
  RoadsideStatusInput,
} from "@autocare/contracts";
import { api } from "../../shared/api";

/**
 * Staff-side roadside calls (F-17, F-18). Deliberately not cached or queued
 * through the outbox: an incident is a live, connected activity, and a stale
 * board would send a driver to a call somebody else already closed. The outbox
 * stays for inspection drafts, which genuinely are offline work.
 */
export const roadsideApi = {
  /** Open incidents, oldest first — the queue order the API already returns. */
  board: () => api.get<RoadsideRequestView[]>("/roadside/board"),
  dispatch: (id: string, dto: RoadsideDispatchInput) =>
    api.post<RoadsideRequestView>(`/roadside/requests/${id}/dispatch`, dto),
  setStatus: (id: string, dto: RoadsideStatusInput) =>
    api.patch<RoadsideRequestView>(`/roadside/requests/${id}/status`, dto),
  resolve: (id: string, dto: RoadsideResolveInput) =>
    api.post<RoadsideRequestView>(`/roadside/requests/${id}/resolve`, dto),
};
