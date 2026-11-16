import { fireEvent, render, screen } from "@testing-library/react-native";
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 12 }) }));
jest.mock("../features/tasks/TaskListScreen", () => ({ TaskListScreen: () => { const { Text } = require("react-native"); return <Text>Shop bookings</Text>; } }));
jest.mock("../features/vehicles/VehiclesScreen", () => ({ VehiclesScreen: () => { const { Text } = require("react-native"); return <Text>Registered cars</Text>; } }));
jest.mock("../features/roadside/RoadsideContainer", () => ({ RoadsideContainer: () => { const { Text } = require("react-native"); return <Text>Roadside dispatch</Text>; } }));
jest.mock("../shared/sync", () => ({ syncProcessor: {} }));
jest.mock("../shared/sync/useSyncStatus", () => ({ useSyncStatus: () => ({ pendingCount: 3, rejectedCount: 1 }) }));
import { FieldHome } from "./FieldHome";
const props = { staffId: "staff-a", name: "Staff", onOpenBooking: jest.fn(), onOpenVehicle: jest.fn(), onOpenSyncQueue: jest.fn(), onLogout: jest.fn() };
it.each(["ADMIN", "ADVISOR"])("%s has all four destinations", (role) => {
  render(<FieldHome {...props} role={role} />);
  expect(screen.getAllByRole("tab").map((e) => e.props.accessibilityLabel)).toEqual(["Bookings", "Vehicles", "Roadside", "More"]);
  expect(screen.getByText("Shop bookings")).toBeTruthy();
});
it("mechanic has no dispatch destination and can reach sync and sign out from More", () => {
  render(<FieldHome {...props} role="MECHANIC" />);
  expect(screen.queryByRole("tab", { name: "Roadside" })).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "More" }));
  fireEvent.press(screen.getByLabelText("Open sync queue"));
  expect(props.onOpenSyncQueue).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId("staff-logout")); expect(props.onLogout).not.toHaveBeenCalled();
  expect(screen.getByText(/3 entries have not synced/)).toBeTruthy();
  fireEvent.press(screen.getByTestId("staff-logout-confirm")); expect(props.onLogout).toHaveBeenCalled();
});
it("driver lands on Roadside without ever mounting the forbidden booking list", () => {
  render(<FieldHome {...props} role="DRIVER" />);
  expect(screen.getByText("Roadside dispatch")).toBeTruthy(); expect(screen.queryByText("Shop bookings")).toBeNull();
  expect(screen.queryByRole("tab", { name: "Bookings" })).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "Vehicles" })); expect(screen.getByText("Registered cars")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Vehicles" }).props.accessibilityState.selected).toBe(true);
});
