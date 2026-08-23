import { ApiClient } from "@autocare/api-client";
import { EntitlementSummary } from "@autocare/contracts";

export type BookingServiceType = {
  id: string;
  code: string;
  name: string;
  standardDurationMin: number;
  priceCentavos: number;
  entitlementType: string | null;
};

export type Slot = { start: string; end: string; bayId: string; serviceTypeId: string };

export type MemberAppointment = {
  id: string;
  vehicleId: string;
  serviceTypeId: string;
  bayId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  requiresPickup: boolean;
};

/** Typed scheduling/booking calls on the shared `api` client, mirroring subscriptionApi. */
export function makeBookingApi(api: ApiClient) {
  return {
    listServiceTypes: () => api.get<BookingServiceType[]>("/scheduling/service-types"),

    getSlots: (from: string, to: string, serviceTypeId: string) =>
      api.get<Slot[]>(`/scheduling/slots?from=${from}&to=${to}&serviceTypeId=${serviceTypeId}`),

    hold: (bayId: string, start: string, serviceTypeId: string) =>
      api.post<{ holdId: string }>("/scheduling/holds", { bayId, start, serviceTypeId }),

    releaseHold: (holdId: string) => api.del<{ released: boolean }>(`/scheduling/holds/${encodeURIComponent(holdId)}`),

    book: (holdId: string, vehicleId: string, serviceTypeId: string, requiresPickup: boolean) =>
      api.post<MemberAppointment>("/appointments", { holdId, vehicleId, serviceTypeId, requiresPickup }),

    listAppointments: () => api.get<MemberAppointment[]>("/appointments"),

    reschedule: (id: string, holdId: string) => api.patch<MemberAppointment>(`/appointments/${id}/reschedule`, { holdId }),

    cancel: (id: string) => api.post<MemberAppointment>(`/appointments/${id}/cancel`),

    getEntitlements: (subscriptionId: string) => api.get<EntitlementSummary[]>(`/subscriptions/${subscriptionId}/entitlements`),
  };
}

export type BookingApi = ReturnType<typeof makeBookingApi>;
