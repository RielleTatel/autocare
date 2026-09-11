// Client-side typed fetchers for the advisor scheduling surfaces. Every call goes through the
// same-origin BFF proxy (/api/proxy/*), which attaches the httpOnly session cookie server-side.

export type BoardAppointment = {
  id: string;
  bayId: string | null;
  serviceTypeId: string;
  serviceTypeName: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  requiresPickup: boolean;
  vehiclePlateNo: string;
  memberName: string | null;
};

export type ServiceType = { id: string; code: string; name: string; standardDurationMin: number };
export type Bay = { id: string; name: string; capabilities: string[]; isActive: boolean };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

export const getBoard = (from: string, to: string) =>
  call<BoardAppointment[]>(`scheduling/board?from=${from}&to=${to}`);

export type Slot = { start: string; end: string; bayId: string; serviceTypeId: string };

// Availability is per service type, not a single true "open/busy" — duration and
// required mechanic skills both vary by service. There is no service-type-agnostic
// notion of an open slot; see the capacity engine's qualifiedMechanics check.
export const getSlots = (from: string, to: string, serviceTypeId: string) =>
  call<Slot[]>(`scheduling/slots?from=${from}&to=${to}&serviceTypeId=${serviceTypeId}`);

export const getServiceTypes = () => call<ServiceType[]>("scheduling/service-types");
export const getBays = () => call<Bay[]>("scheduling/bays");

export const cancelAppointment = (id: string) =>
  call<BoardAppointment>(`appointments/${id}/cancel`, { method: "POST" });

export const createBay = (name: string, capabilities: string[]) =>
  call<Bay>("scheduling/bays", { method: "POST", body: JSON.stringify({ name, capabilities }) });

export const createServiceType = (input: { code: string; name: string; standardDurationMin: number; requiredSkills: string[]; priceCentavos: number }) =>
  call<ServiceType>("scheduling/service-types", { method: "POST", body: JSON.stringify(input) });

export const upsertOperatingHours = (input: { weekday?: string; dateOverride?: string; openTime?: string; closeTime?: string; walkInBufferPct: number }) =>
  call<unknown>("scheduling/operating-hours", { method: "PUT", body: JSON.stringify(input) });

export type DayUtilisation = { date: string; booked: number; available: number; ratio: number };
export const getUtilisation = (windowDays = 14) => call<DayUtilisation[]>(`admin/capacity/utilisation?window=${windowDays}d`);

export type OperatingHours = {
  weekday: string | null;
  dateOverride: string | null;
  openTime: string | null;
  closeTime: string | null;
  walkInBufferPct: number;
};
export const getOperatingHours = () => call<OperatingHours[]>("scheduling/operating-hours");

/**
 * Roster. A slot is only offered when a qualified mechanic's shift covers it, so
 * these are the calls that actually decide how early and how late the shop can
 * be booked — operating hours alone change nothing.
 */
export type Shift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  skills: string[];
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string;
};

/** Staff who can be rostered. Staff-gated, unlike the admin staff directory. */
export type RosterableStaff = { id: string; name: string | null; role: string };
export const getRosterableStaff = () => call<RosterableStaff[]>("scheduling/rosterable-staff");

export const getShifts = (from: string, to: string) =>
  call<Shift[]>(`scheduling/shifts?from=${from}&to=${to}`);

export const createShift = (input: { userId: string; date: string; startTime: string; endTime: string; skills: string[] }) =>
  call<Shift>("scheduling/shifts", { method: "POST", body: JSON.stringify(input) });

export const updateShift = (id: string, input: { date?: string; startTime?: string; endTime?: string; skills?: string[] }) =>
  call<Shift>(`scheduling/shifts/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteShift = (id: string) =>
  call<{ deleted: boolean }>(`scheduling/shifts/${id}`, { method: "DELETE" });
