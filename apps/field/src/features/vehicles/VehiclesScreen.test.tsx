import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Vehicle } from "@autocare/contracts";
jest.mock("@react-navigation/native", () => ({ useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]) }));
jest.mock("../../shared/api", () => ({ API_BASE_URL: "test", api: { get: jest.fn() } }));
jest.mock("../../shared/db/kv", () => ({ kvGet: jest.fn().mockResolvedValue(null), kvSet: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../shared/sync", () => ({ syncProcessor: {} }));
jest.mock("../../shared/sync/useSyncStatus", () => ({ useSyncStatus: () => ({ lastSyncAt: null }) }));
import { api } from "../../shared/api";
import { kvSet } from "../../shared/db/kv";
import { searchVehicles, VehiclesScreen } from "./VehiclesScreen";
const defaults = { variant: null, engineCc: null, fuelType: "GASOLINE" as const, transmission: "AT" as const, color: null, vin: null, orCrUrls: [], lastServiceAt: null };
const vehicles: Vehicle[] = [
  { ...defaults, id: "v1", plateNo: "ABC 1234", make: "Toyota", model: "Vios", year: 2022, status: "ACTIVE", currentOdometerKm: 40000, photoUrls: [] },
  { ...defaults, id: "v2", plateNo: "XYZ 5678", make: "Honda", model: "City", year: 2020, status: "ACTIVE", currentOdometerKm: 30000, photoUrls: [] },
];
beforeEach(() => { jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue(vehicles); });
it("finds mixed identity terms and plate punctuation without losing the make filter", () => {
  expect(searchVehicles(vehicles, "ABC-1234")).toEqual([vehicles[0]]);
  expect(searchVehicles(vehicles, "abc1234")).toEqual([vehicles[0]]);
  expect(searchVehicles(vehicles, "  VIOS 2022 Toyota ")).toEqual([vehicles[0]]);
  expect(searchVehicles(vehicles, "2022", "Honda")).toEqual([]);
});
it("keeps search and a removable make filter while switching the compact default to grid", async () => {
  const open = jest.fn();
  render(<VehiclesScreen onOpenVehicle={open} />);
  fireEvent.press(await screen.findByLabelText("Open vehicle ABC 1234"));
  expect(open).toHaveBeenCalledWith(vehicles[0]);
  expect(screen.getByTestId("vehicle-list")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Filter vehicles by make"));
  fireEvent.press(screen.getByRole("radio", { name: "Toyota" }));
  fireEvent.changeText(screen.getByLabelText("Search registered vehicles"), "vios");
  expect(screen.queryByLabelText("Open vehicle XYZ 5678")).toBeNull();
  fireEvent.press(screen.getByLabelText("Grid view"));
  expect(screen.getByTestId("vehicle-grid")).toBeTruthy();
  expect(screen.getByLabelText("Search registered vehicles").props.value).toBe("vios");
  expect(screen.getByLabelText("Remove Toyota filter")).toBeTruthy();
  await waitFor(() => expect(kvSet).toHaveBeenCalledWith("vehicle-view", "grid"));
  fireEvent.press(screen.getByLabelText("Clear all"));
  expect(screen.getByLabelText("Open vehicle XYZ 5678")).toBeTruthy();
  expect((api.get as jest.Mock).mock.calls.every(([path]) => path === "/vehicles")).toBe(true);
});
