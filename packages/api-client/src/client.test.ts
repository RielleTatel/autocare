import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiError } from "./client";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data, meta: null, error: null }) });
const err = (code: string, status = 402) => ({ ok: false, status, json: async () => ({ success: false, data: null, meta: null, error: { code, message: "nope" } }) });

describe("api client", () => {
  it("attaches bearer token and unwraps envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ user: { id: "u1" } }));
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "tok", fetchImpl: fetchMock as any });
    const out = await api.post<{ user: { id: string } }>("/auth/session");
    expect(out.user.id).toBe("u1");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("throws ApiError with machine code on failure envelope", async () => {
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => null, fetchImpl: vi.fn().mockResolvedValue(err("ENTITLEMENT_EXHAUSTED")) as any });
    await expect(api.get("/subscriptions")).rejects.toMatchObject({ code: "ENTITLEMENT_EXHAUSTED" });
  });
  it("supports DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "v1", status: "ARCHIVED" }));
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "tok", fetchImpl: fetchMock as any });
    const out = await api.del<{ status: string }>("/vehicles/v1");
    expect(out.status).toBe("ARCHIVED");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
