import { fireEvent, render } from "@testing-library/react-native";
import { VehicleDetailScreen } from "./VehicleDetailScreen";
import type { Vehicle } from "@autocare/contracts";

const vehicle = {
  id: "v1",
  plateNo: "ABA1234",
  make: "Toyota",
  model: "Vios",
  year: 2020,
  fuelType: "GASOLINE",
  transmission: "CVT",
  variant: null,
  vin: null,
  photoUrls: [],
  currentOdometerKm: 42000,
} as unknown as Vehicle;

const props = () => ({
  vehicle,
  onUpdateOdometer: jest.fn().mockResolvedValue(undefined),
  onArchive: jest.fn().mockResolvedValue(undefined),
  onArchived: jest.fn(),
});

describe("VehicleDetailScreen", () => {
  it("puts everything needed to recognise the car in one block", () => {
    const { getByTestId, getByText } = render(<VehicleDetailScreen {...props()} />);
    getByTestId("vehicle-identity");
    getByText("2020 Toyota Vios");
    getByText("ABA1234");
    expect(getByTestId("identity-odometer").props.children.join("")).toContain("42,000");
  });

  it("says what belongs in an empty photo frame instead of showing a blank block", () => {
    const { getByTestId, getByText } = render(<VehicleDetailScreen {...props()} />);
    getByTestId("no-photo");
    getByText("No photo yet");
  });

  it("summarises the score when the vehicle has been inspected", () => {
    const { getByTestId } = render(
      <VehicleDetailScreen {...props()} health={{ score: 82, band: "GOOD" }} onViewHealthScore={jest.fn()} />,
    );
    expect(getByTestId("health-summary").props.children.join("")).toContain("82");
  });

  it("promises a score rather than showing an empty one before the first inspection", () => {
    const { getByText, queryByTestId } = render(<VehicleDetailScreen {...props()} />);
    getByText("Coming with your first inspection");
    expect(queryByTestId("health-summary")).toBeNull();
  });

  it("keeps the odometer editable from the identity block", () => {
    const { getByTestId } = render(<VehicleDetailScreen {...props()} />);
    expect(getByTestId("odometer-update")).toBeTruthy();
  });
});

describe("VehicleDetailScreen — hero and detail sheet", () => {
  it("floats a back control over the hero, so the photo is not a dead end", () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<VehicleDetailScreen {...props()} onBack={onBack} />);
    fireEvent.press(getByTestId("vehicle-back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("leads with the score, not the chip — condition before cosmetics", () => {
    const { getByTestId } = render(
      <VehicleDetailScreen {...props()} health={{ score: 68, band: "FAIR" }} />,
    );
    const numeral = getByTestId("vehicle-score");
    expect(numeral.props.children).toBe(68);
    // 72px: the `score` type role, the largest in the scale.
    const style = Array.isArray(numeral.props.style) ? Object.assign({}, ...numeral.props.style) : numeral.props.style;
    expect(style.fontSize).toBeGreaterThanOrEqual(64);
  });

  // The band's `text` variant is the one meant for light surfaces — 5.6:1 at
  // worst — so the score states its own band rather than repeating it in a chip.
  it("paints the numeral in the band's light-surface colour", () => {
    const { getByTestId, getByText } = render(
      <VehicleDetailScreen {...props()} health={{ score: 22, band: "CRITICAL" }} />,
    );
    const numeral = getByTestId("vehicle-score");
    const style = Array.isArray(numeral.props.style) ? Object.assign({}, ...numeral.props.style) : numeral.props.style;
    expect(style.color).toBe("#8F1D17");
    expect(getByTestId("vehicle-band")).toBeTruthy();
    getByText("Critical");
  });

  it("keeps all three overview stats", () => {
    const { getByText, getByTestId } = render(
      <VehicleDetailScreen {...props()} health={{ score: 68, band: "FAIR" }} openItems={3} lastServiceAt="2026-09-12T00:00:00.000Z" />,
    );
    getByText("Overview");
    expect(getByTestId("stat-odometer")).toBeTruthy();
    expect(getByTestId("stat-last-service")).toBeTruthy();
    expect(getByTestId("stat-watch")).toBeTruthy();
    getByText("3");
  });

  // An unserviced car is the normal state for a new member, not an error.
  it("says a stat is not known yet rather than showing a blank", () => {
    const { getByTestId } = render(<VehicleDetailScreen {...props()} />);
    expect(getByTestId("stat-last-service").props.children).toBeDefined();
    getByTestId("stat-watch");
  });

  it("offers the one action this page was missing", () => {
    const onBookService = jest.fn();
    const { getByTestId } = render(<VehicleDetailScreen {...props()} onBookService={onBookService} />);
    fireEvent.press(getByTestId("vehicle-book-service"));
    expect(onBookService).toHaveBeenCalled();
  });

  // Tracked-out caps above every block is the commonest generated-UI tell, and
  // the screen carried three of them.
  it("titles sections in sentence case", () => {
    const { queryByText, getByText } = render(<VehicleDetailScreen {...props()} />);
    expect(queryByText("SPECIFICATIONS")).toBeNull();
    getByText("Specifications");
  });
});
