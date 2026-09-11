// Admin-only staff administration. Same BFF proxy as the scheduling client:
// every call is same-origin and the httpOnly session cookie is attached
// server-side, so no token is ever handled in the browser.

export type StaffUser = {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  /** Roster entries from today onward — what a demotion would cancel. */
  upcomingShifts: number;
};

export const ASSIGNABLE_ROLES = ["MECHANIC", "ADVISOR", "DRIVER", "ADMIN", "MEMBER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Roles that can sign in to the staff console or the field app. */
export const STAFF_ROLES: readonly string[] = ["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"];

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

/** `scope: "ALL"` widens past current staff to members, which is how someone
 *  who has signed in once is found so they can be given a role. */
export const getStaff = (opts: { q?: string; scope?: "STAFF" | "ALL" } = {}) => {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("scope", opts.scope ?? "STAFF");
  return call<StaffUser[]>(`users/staff?${params.toString()}`);
};

/** `reason` is required by the API and written to the audit log. */
export const setUserRole = (id: string, role: AssignableRole, reason: string) =>
  call<StaffUser & { clearedShifts: number }>(`users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, reason }),
  });
