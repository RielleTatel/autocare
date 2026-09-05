// A-16 admin broadcast console (FR-107). Same BFF proxy as the other admin clients:
// every call is same-origin and the httpOnly session cookie is attached server-side,
// so no token is ever handled in the browser.

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  status: "ACTIVE" | "SUPERSEDED" | "DISMISSED";
  publishedAt: string;
  expiresAt: string | null;
};

export type BroadcastDraft = { title: string; body: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

export const getBroadcasts = () => call<Broadcast[]>("admin/announcements");

export const createBroadcast = (dto: BroadcastDraft) =>
  call<{ ok: true }>("admin/announcements", { method: "POST", body: JSON.stringify(dto) });

export const unpublishBroadcast = (id: string) =>
  call<{ ok: true }>(`admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify({}) });
