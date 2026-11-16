import { fireEvent, render, screen } from "@testing-library/react-native";
import { api } from "../../shared/api";
import { TaskDetailScreen } from "./TaskDetailScreen";

jest.mock("../../shared/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../history/VehicleHistory", () => ({ VehicleHistory: () => null }));

const vehicle = { id: "veh-1", plateNo: "ABA1234", make: "Toyota", model: "Vios", year: 2022, currentOdometerKm: 42000 };
const other = { ...vehicle, id: "veh-2", plateNo: "OTHER123" };
const get = api.get as jest.Mock;

beforeEach(() => {
  get.mockImplementation(async (path: string) => path === "/vehicles" ? [vehicle, other] : vehicle);
});

it("starts only the booked vehicle and displays the booking being completed", async () => {
  const onStart = jest.fn();
  render(<TaskDetailScreen initialVehicleId="veh-1" appointmentId="booking-1" onStart={onStart} />);
  await screen.findByDisplayValue("42000");
  expect(screen.getByText("booking-1")).toBeTruthy();
  expect(screen.queryByLabelText("Search plate number")).toBeNull();
  expect(screen.queryByText(/OTHER123/)).toBeNull();
  fireEvent.press(screen.getByLabelText("Begin 50-point inspection"));
  expect(onStart).toHaveBeenCalledWith(vehicle, 42000);
});

it("does not offer another vehicle when the booked one cannot be loaded", async () => {
  get.mockRejectedValue(new Error("Booked vehicle unavailable"));
  const onStart = jest.fn();
  render(<TaskDetailScreen initialVehicleId="veh-1" appointmentId="booking-1" onStart={onStart} />);
  await screen.findByText("Booked vehicle unavailable");
  expect(screen.queryByLabelText("Begin 50-point inspection")).toBeNull();
  expect(onStart).not.toHaveBeenCalled();
});

it("rejects a response for another vehicle", async () => {
  get.mockResolvedValue(other);
  const onStart = jest.fn();
  render(<TaskDetailScreen initialVehicleId="veh-1" appointmentId="booking-1" onStart={onStart} />);
  await screen.findByText(/does not match the booking/i);
  expect(screen.queryByLabelText("Begin 50-point inspection")).toBeNull();
});
