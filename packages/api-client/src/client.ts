export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}
export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await opts.getToken();
    let res: Response;
    try {
      res = await f(`${opts.baseUrl}/api/v1${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError("NETWORK", "Cannot reach the server. Check your connection.", 0);
    }
    const envelope = await res.json().catch(() => null);
    if (envelope?.success) return envelope.data as T;
    throw new ApiError(envelope?.error?.code ?? "INTERNAL", envelope?.error?.message ?? "Unexpected error", res.status);
  }
  return {
    get: <T>(p: string) => call<T>("GET", p),
    post: <T>(p: string, b?: unknown) => call<T>("POST", p, b),
    patch: <T>(p: string, b?: unknown) => call<T>("PATCH", p, b),
    del: <T>(p: string) => call<T>("DELETE", p),
    createSession: () => call<import("@autocare/contracts").SessionResponse>("POST", "/auth/session"),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
