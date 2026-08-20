import { fireEvent, render } from "@testing-library/react-native";
import { AddVehicleScreen } from "./AddVehicleScreen";

describe("AddVehicleScreen", () => {
  it("shows the plate error inline after an invalid submit", () => {
    const { getByTestId, getByText } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    fireEvent.changeText(getByTestId("field-plateNo"), "1234ABC");
    fireEvent.press(getByTestId("submit"));
    getByText(/not a valid ph plate/i);
  });
});
