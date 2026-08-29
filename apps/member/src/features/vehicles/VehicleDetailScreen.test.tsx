import { render } from "@testing-library/react-native";
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
