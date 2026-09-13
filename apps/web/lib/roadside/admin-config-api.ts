export type RoadsideEligibilityConfig = {
  waitingDays: number;
  requireClearedPayment: boolean;
};

export type RoadsideEligibilityConfigUpdate = RoadsideEligibilityConfig & { reason: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  return body.data as T;
}

export const getRoadsideEligibilityConfig = () => call<RoadsideEligibilityConfig>("roadside/admin/config");
export const updateRoadsideEligibilityConfig = (dto: RoadsideEligibilityConfigUpdate) =>
  call<RoadsideEligibilityConfig>("roadside/admin/config", { method: "PATCH", body: JSON.stringify(dto) });
