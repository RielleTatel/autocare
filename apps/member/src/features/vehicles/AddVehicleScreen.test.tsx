import { fireEvent, render } from "@testing-library/react-native";
import { AddVehicleScreen } from "./AddVehicleScreen";

describe("AddVehicleScreen", () => {
  it("shows the plate error inline after an invalid submit", () => {
    const { getByTestId, getByText } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    fireEvent.changeText(getByTestId("field-plateNo"), "1234ABC");
    fireEvent.press(getByTestId("submit"));
    getByText(/not a valid ph plate/i);
  });

  it("holds the preview back until the car is identifiable", () => {
    const { getByTestId, queryByTestId } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    expect(queryByTestId("vehicle-preview")).toBeNull();

    fireEvent.changeText(getByTestId("field-plateNo"), "ABA 1234");
    expect(queryByTestId("vehicle-preview")).toBeNull(); // a plate alone is not a car

    fireEvent.changeText(getByTestId("field-make"), "Toyota");
    expect(queryByTestId("vehicle-preview")).not.toBeNull();
  });

  it("builds the preview from what has been typed so far", () => {
    const { getByTestId, getByText } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    fireEvent.changeText(getByTestId("field-plateNo"), "ABA 1234");
    fireEvent.changeText(getByTestId("field-make"), "Toyota");
    fireEvent.changeText(getByTestId("field-model"), "Vios");
    fireEvent.changeText(getByTestId("field-year"), "2020");
    fireEvent.changeText(getByTestId("field-odometerKm"), "42000");

    getByText("2020 Toyota Vios");
    getByText("42,000 km");
  });

  it("keeps secondary fields folded away until asked for", () => {
    const { getByTestId, queryByTestId } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    expect(queryByTestId("field-vin")).toBeNull();
    fireEvent.press(getByTestId("more-details-toggle"));
    expect(queryByTestId("field-vin")).not.toBeNull();
  });
});
