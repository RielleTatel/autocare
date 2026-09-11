import { fireEvent, render } from "@testing-library/react-native";
import { LinearGradient, Rect } from "react-native-svg";
import type { Vehicle } from "@autocare/contracts";
import { VehicleCard } from "./VehicleCard";

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: "v1",
  plateNo: "ABC 1234",
  make: "Toyota", model: "Vios", year: 2019,
  variant: "1.3 XE", engineCc: 1329,
  fuelType: "GASOLINE", transmission: "AT",
  color: "Silver", vin: null,
  photoUrls: [], orCrUrls: [],
  currentOdometerKm: 48210,
  status: "ACTIVE",
  lastServiceAt: null,
  ...over,
});

describe("VehicleCard", () => {
  it("leads with the vehicle, its trim, and the facts checked at a glance", () => {
    const { getByText } = render(
      <VehicleCard vehicle={vehicle()} health={{ score: 69, band: "FAIR" }} />,
    );
    getByText("2019 Toyota Vios");
    getByText("1.3 XE");
    getByText("ABC 1234");
    getByText("48,210 km");
    getByText("Fair");
    getByText("69");
  });

  // The reference's subtitle is the trim; without one the plate is the next
  // most identifying thing, and the line is never left blank.
  it("falls back to the plate when the vehicle has no trim", () => {
    const { getAllByText } = render(<VehicleCard vehicle={vehicle({ variant: null })} />);
    expect(getAllByText("ABC 1234").length).toBeGreaterThanOrEqual(1);
  });

  // An uninspected vehicle has no score; showing a band would invent one.
  it("says a vehicle is uninspected rather than faking a band", () => {
    const { getByText, queryByText } = render(<VehicleCard vehicle={vehicle()} health={null} />);
    getByText("Not yet inspected");
    expect(queryByText("Fair")).toBeNull();
  });

  it("opens the score from the card", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <VehicleCard testID="vc" vehicle={vehicle()} health={{ score: 69, band: "FAIR" }} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("vc"));
    expect(onPress).toHaveBeenCalled();
  });

  // The arrow is decorative — the card is the button and carries the label, so
  // the score and band have to reach a screen reader from the card itself.
  // SVG ids share one namespace across the whole react-native-svg tree, so a
  // fixed id made every card on the vehicles list paint itself with the first
  // card's gradient.
  it("gives each card its own gradient id", () => {
    const { getByTestId, UNSAFE_getAllByType } = render(
      <>
        <VehicleCard testID="a" vehicle={vehicle({ id: "v1" })} />
        <VehicleCard testID="b" vehicle={vehicle({ id: "v2" })} />
      </>,
    );
    // The gradient only paints once the card has been measured, so the layout
    // pass has to be simulated — it never fires in the test renderer.
    for (const id of ["a", "b"]) {
      fireEvent(getByTestId(id), "layout", { nativeEvent: { layout: { width: 320, height: 200 } } });
    }
    const ids = UNSAFE_getAllByType(LinearGradient).map((g) => g.props.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("paints the gradient at the measured size once laid out", () => {
    const { getByTestId, UNSAFE_getAllByType, UNSAFE_queryAllByType } = render(
      <VehicleCard testID="vc" vehicle={vehicle()} />,
    );
    expect(UNSAFE_queryAllByType(Rect)).toHaveLength(0);

    fireEvent(getByTestId("vc"), "layout", { nativeEvent: { layout: { width: 320, height: 210 } } });

    const rect = UNSAFE_getAllByType(Rect)[0];
    expect(rect.props.width).toBe(320);
    expect(rect.props.height).toBe(210);
  });

  it("names the score and band on the card, not on the arrow", () => {
    const { getByTestId } = render(
      <VehicleCard testID="vc" vehicle={vehicle()} health={{ score: 69, band: "FAIR" }} onPress={jest.fn()} />,
    );
    expect(getByTestId("vc").props.accessibilityLabel).toBe(
      "2019 Toyota Vios, health score 69, Fair",
    );
  });
});
