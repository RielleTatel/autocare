import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BottomSheet, MeasuredRow } from "./BottomSheet";

describe("BottomSheet", () => {
  it("renders title, content and the dismissing action", () => {
    render(
      <BottomSheet title="Brakes" onClose={() => undefined}>
        <Text>Front pads are below threshold.</Text>
      </BottomSheet>,
    );
    expect(screen.getByText("Brakes")).toBeTruthy();
    expect(screen.getByText("Front pads are below threshold.")).toBeTruthy();
    expect(screen.getByLabelText("Got it")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    render(<BottomSheet open={false} title="Brakes" onClose={() => undefined} />);
    expect(screen.queryByText("Brakes")).toBeNull();
  });

  it("closes from the dismissing action", () => {
    const onClose = jest.fn();
    render(<BottomSheet title="Brakes" onClose={onClose} closeLabel="Close" />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close on a press inside the panel", () => {
    const onClose = jest.fn();
    render(
      <BottomSheet testID="sheet" title="Brakes" onClose={onClose}>
        <Text>body</Text>
      </BottomSheet>,
    );
    fireEvent.press(screen.getByTestId("sheet"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("MeasuredRow", () => {
  it("renders the measured readout", () => {
    render(<MeasuredRow>Measured 3 mm · good ≥ 5 mm</MeasuredRow>);
    expect(screen.getByText("Measured 3 mm · good ≥ 5 mm")).toBeTruthy();
  });
});

describe("BottomSheet scrim", () => {
  it("dismisses from the scrim under its own label", () => {
    const onClose = jest.fn();
    render(<BottomSheet title="Brakes" onClose={onClose} closeLabel="Close" />);
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(onClose).toHaveBeenCalled();
  });
});
