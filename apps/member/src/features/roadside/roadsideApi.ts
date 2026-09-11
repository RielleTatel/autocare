import type { RoadsideEligibility, RoadsideRequestInput, RoadsideRequestView } from "@autocare/contracts";
import { api } from "../../shared/api";

export const roadsideApi = {
  eligibility: () => api.get<RoadsideEligibility>("/roadside/eligibility"),
  create: (dto: RoadsideRequestInput) => api.post<RoadsideRequestView>("/roadside/requests", dto),
  active: () => api.get<RoadsideRequestView | null>("/roadside/requests/active"),
  byId: (id: string) => api.get<RoadsideRequestView>(`/roadside/requests/${id}`),
};
