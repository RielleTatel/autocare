type RequestRecord = { endpoint: string; time: number };

/** Development diagnostics: retain a bounded sample and report only HTTP 429. */
export function withRateLimitDiagnostics(
  fetchImpl: typeof fetch,
  warn: (message: string, detail: unknown) => void = console.warn,
  now: () => number = Date.now,
): typeof fetch {
  let recent: RequestRecord[] = [];
  return async (input, init) => {
    const rawUrl = typeof input === "object" && "url" in input ? input.url : String(input);
    // Drop the origin and query string; neither is needed to identify the handler.
    const path = new URL(rawUrl, "http://diagnostic.invalid").pathname;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const endpoint = `${method.toUpperCase()} ${path}`;
    const time = now();
    recent = [...recent.filter(request => request.time > time - 60_000), { endpoint, time }].slice(-200);
    const response = await fetchImpl(input, init);
    if (response.status === 429) {
      const counts: Record<string, number> = {};
      const cutoff = now() - 60_000;
      for (const request of recent) {
        if (request.time > cutoff) counts[request.endpoint] = (counts[request.endpoint] ?? 0) + 1;
      }
      warn("[Member API] HTTP 429", {
        endpoint,
        retryAfter: response.headers.get("retry-after"),
        // A sample of at most 200 calls from this app instance in the last minute.
        recentRequestSample: counts,
      });
    }
    return response;
  };
}
