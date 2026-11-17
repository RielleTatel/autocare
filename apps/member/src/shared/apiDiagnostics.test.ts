import { withRateLimitDiagnostics } from "./apiDiagnostics";

it("identifies the rate-limited endpoint and recent calls without logging auth or query values", async () => {
  const response = { status: 429, headers: new Headers({ "retry-after": "60" }) } as Response;
  const upstream = jest.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValue(response);
  const warn = jest.fn();
  const wrapped = withRateLimitDiagnostics(upstream, warn, () => 1000);
  const url = "https://example.test/api/v1/vehicles/vehicle/health-score?private=value";
  await wrapped(url, { headers: { Authorization: "Bearer secret" } });
  expect(warn).not.toHaveBeenCalled();
  expect(await wrapped(url)).toBe(response);
  expect(upstream).toHaveBeenCalledTimes(2);
  expect(warn).toHaveBeenCalledWith("[Member API] HTTP 429", {
    endpoint: "GET /api/v1/vehicles/vehicle/health-score", retryAfter: "60",
    recentRequestSample: { "GET /api/v1/vehicles/vehicle/health-score": 2 },
  });
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private|value|Bearer|secret/);
});

it("forwards network failures unchanged", async () => {
  const error = new Error("Network unavailable");
  const upstream = jest.fn().mockRejectedValue(error);
  const warn = jest.fn();
  const wrapped = withRateLimitDiagnostics(upstream, warn);
  await expect(wrapped("https://example.test/api/v1/vehicles")).rejects.toBe(error);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

it("excludes calls older than a minute from the request summary", async () => {
  let time = 0;
  const warn = jest.fn();
  const upstream = jest.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValue({ status: 429, headers: new Headers() });
  const wrapped = withRateLimitDiagnostics(upstream, warn, () => time);
  await wrapped("https://example.test/api/v1/vehicles");
  time = 61_000;
  await wrapped("https://example.test/api/v1/vehicles/vehicle/health-score");
  expect(warn.mock.calls[0][1].recentRequestSample).toEqual({ "GET /api/v1/vehicles/vehicle/health-score": 1 });
});
