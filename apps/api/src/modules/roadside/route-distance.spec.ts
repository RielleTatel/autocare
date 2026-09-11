import { routeDistanceKm } from "./route-distance";

describe("routeDistanceKm", () => {
  const from = { lat: 6.9214, lng: 122.079 };
  const to = { lat: 6.91, lng: 122.07 };

  beforeEach(() => {
    process.env.MAPBOX_TOKEN = "pk.test-token";
  });
  afterEach(() => jest.restoreAllMocks());

  it("converts Mapbox metres to kilometres", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 4321 }] }),
    }) as unknown as typeof fetch;

    expect(await routeDistanceKm(from, to)).toBeCloseTo(4.321, 3);
  });

  it("returns null when Mapbox finds no route rather than failing the resolution", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    }) as unknown as typeof fetch;

    expect(await routeDistanceKm(from, to)).toBeNull();
  });

  it("returns null when the call throws", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect(await routeDistanceKm(from, to)).toBeNull();
  });
});
