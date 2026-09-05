import { fireEvent, render } from "@testing-library/react-native";
import { OnboardingScreen } from "./OnboardingScreen";

describe("OnboardingScreen", () => {
  it("leads each slide with its promise", () => {
    const { getByText } = render(<OnboardingScreen onGetStarted={jest.fn()} />);
    expect(getByText("Your car, always cared for")).toBeTruthy();
    expect(getByText("Stay ahead of maintenance")).toBeTruthy();
    expect(getByText("Service when you need it")).toBeTruthy();
  });

  it("renders one hero slide per promise", () => {
    const { getByTestId } = render(<OnboardingScreen onGetStarted={jest.fn()} />);
    expect(getByTestId("slide-0")).toBeTruthy();
    expect(getByTestId("slide-1")).toBeTruthy();
    expect(getByTestId("slide-2")).toBeTruthy();
  });

  it("marks the first slide as the current position", () => {
    const { getByTestId } = render(<OnboardingScreen onGetStarted={jest.fn()} />);
    // The active dot is widened rather than only recoloured, so position is
    // readable without relying on colour alone.
    expect(getByTestId("dot-0").props.style.width).toBe(20);
    expect(getByTestId("dot-1").props.style.width).toBe(8);
  });

  it("starts the app from the primary action", () => {
    const onGetStarted = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onGetStarted={onGetStarted} />);
    fireEvent.press(getByTestId("get-started"));
    expect(onGetStarted).toHaveBeenCalled();
  });
});
