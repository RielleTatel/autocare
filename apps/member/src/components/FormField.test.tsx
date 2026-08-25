import { render, screen, fireEvent } from "@testing-library/react-native";
import { FormField } from "./FormField";

describe("member FormField", () => {
  it("emits text changes", () => {
    const onChangeText = jest.fn();
    render(<FormField label="Plate" value="" onChangeText={onChangeText} testID="plate" />);
    fireEvent.changeText(screen.getByTestId("plate"), "ABC");
    expect(onChangeText).toHaveBeenCalledWith("ABC");
  });
  it("shows a sentence-form error", () => {
    render(<FormField label="Plate" value="" error="Enter a plate number to continue." testID="plate" />);
    expect(screen.getByText("Enter a plate number to continue.")).toBeTruthy();
  });
});
