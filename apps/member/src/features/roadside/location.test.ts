import { captureLocation } from "./location";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const Location = require("expo-location");

// Mapbox Geocoding is a plain REST call (plan D-2), so it is mocked at `fetch`.
const mockGeocode = (body: unknown, ok = true) => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
};

describe("captureLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Expo inlines EXPO_PUBLIC_* at build time; under jest it is a plain env var.
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
  });

  it("returns coordinates and the Mapbox place name", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9214, longitude: 122.079 } });
    mockGeocode({ features: [{ place_name: "Governor Camins Ave, Zamboanga City, Zamboanga del Sur" }] });

    const r = await captureLocation();
    expect(r).toEqual({
      ok: true,
      lat: 6.9214,
      lng: 122.079,
      address: "Governor Camins Ave, Zamboanga City, Zamboanga del Sur",
    });
  });

  it("asks Mapbox for the address of the coordinates it actually got", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9214, longitude: 122.079 } });
    mockGeocode({ features: [] });

    await captureLocation();
    // Mapbox takes lng,lat — in that order. Reversing them silently returns a
    // location in the wrong hemisphere, so this assertion is load-bearing.
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toContain("/122.079,6.9214.json");
  });

  it("reports a denied permission so the screen can ask for a landmark instead", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    expect(await captureLocation()).toEqual({ ok: false, reason: "DENIED" });
  });

  // Geocoding is best-effort (plan D-2). Losing the address must never lose
  // the coordinates — those are what actually gets help to the member.
  it("keeps the coordinates when the network call throws", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("keeps the coordinates when Mapbox returns no features", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    mockGeocode({ features: [] });

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("keeps the coordinates when Mapbox rejects the token", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    mockGeocode({ message: "Not Authorized" }, false);

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("reports an unavailable fix rather than throwing into the screen", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("no fix"));
    expect(await captureLocation()).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });
});
