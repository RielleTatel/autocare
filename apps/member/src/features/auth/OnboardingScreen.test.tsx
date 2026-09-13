import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OnboardingScreen } from "./OnboardingScreen";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderOnboarding(onGetStarted = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <OnboardingScreen onGetStarted={onGetStarted} />
    </SafeAreaProvider>,
  );
}

describe("OnboardingScreen", () => {
  it("leads each slide with its promise", () => {
    const { getByText } = renderOnboarding();
    expect(getByText("Your car, always cared for")).toBeTruthy();
    expect(getByText("Stay ahead of maintenance")).toBeTruthy();
    expect(getByText("Service wherever you are")).toBeTruthy();
  });

  it("renders one supplied illustration per promise", () => {
    const { getByTestId } = renderOnboarding();
    expect(getByTestId("slide-0")).toBeTruthy();
    expect(getByTestId("slide-1")).toBeTruthy();
    expect(getByTestId("slide-2")).toBeTruthy();
    expect(getByTestId("illustration-0")).toBeTruthy();
    expect(getByTestId("illustration-1")).toBeTruthy();
    expect(getByTestId("illustration-2")).toBeTruthy();
  });

  it("always gives the illustrations a visible size", () => {
    const { getByTestId } = renderOnboarding();
    const illustration = getByTestId("illustration-0");

    expect(illustration.props.style.width).toBeGreaterThanOrEqual(240);
    expect(illustration.props.style.height).toBeGreaterThanOrEqual(240);
  });

  it("marks the first slide as the current position", () => {
    const { getByTestId } = renderOnboarding();
    // The active dot is widened rather than only recoloured, so position is
    // readable without relying on colour alone.
    expect(getByTestId("dot-0").props.style.width).toBe(24);
    expect(getByTestId("dot-1").props.style.width).toBe(8);
  });

  it("advances through the promises before starting the app", () => {
    const onGetStarted = jest.fn();
    const { getByTestId, getByText } = renderOnboarding(onGetStarted);

    fireEvent.press(getByTestId("get-started"));
    expect(onGetStarted).not.toHaveBeenCalled();
    expect(getByTestId("dot-1").props.style.width).toBe(24);

    fireEvent.press(getByTestId("get-started"));
    expect(getByText("Get started")).toBeTruthy();
    expect(getByTestId("dot-2").props.style.width).toBe(24);

    fireEvent.press(getByTestId("get-started"));
    expect(onGetStarted).toHaveBeenCalled();
  });
});
