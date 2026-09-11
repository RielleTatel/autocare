import { render, screen, fireEvent } from "@testing-library/react-native";
import type { Vehicle } from "@autocare/contracts";
import { HomeScreen } from "./HomeScreen";

const vehicle = {
  id: "v1", plateNo: "ABC 1234", make: "Toyota", model: "Vios", year: 2019,
  currentOdometerKm: 82500,
} as unknown as Vehicle;

const noop = () => undefined;
const base = {
  firstName: "Rielle",
  vehicle,
  onAddVehicle: noop,
  onUpdateOdometer: noop,
};

describe("HomeScreen — announcements entry point (M-33)", () => {
  it("opens the feed from the masthead", () => {
    const onAnnouncements = jest.fn();
    render(<HomeScreen {...base} onAnnouncements={onAnnouncements} />);
    fireEvent.press(screen.getByTestId("home-announcements"));
    expect(onAnnouncements).toHaveBeenCalled();
  });

  it("badges the unread count, and drops the badge when nothing is waiting", () => {
    const { rerender } = render(
      <HomeScreen {...base} onAnnouncements={noop} unreadAnnouncements={3} />,
    );
    expect(screen.getByTestId("home-announcements-badge")).toHaveTextContent("3");

    rerender(<HomeScreen {...base} onAnnouncements={noop} unreadAnnouncements={0} />);
    expect(screen.queryByTestId("home-announcements-badge")).toBeNull();
  });

  // The entry point is the point — it survives an empty feed, or a member never
  // learns the feed is there.
  it("keeps the bell when there is nothing unread", () => {
    render(<HomeScreen {...base} onAnnouncements={noop} unreadAnnouncements={0} />);
    expect(screen.getByTestId("home-announcements")).toBeTruthy();
  });

  // A three-digit count would be wider than the bell it sits on.
  it("caps the badge at 9+", () => {
    render(<HomeScreen {...base} onAnnouncements={noop} unreadAnnouncements={42} />);
    expect(screen.getByTestId("home-announcements-badge")).toHaveTextContent("9+");
  });

  it("names the unread count to screen readers, since the bell is decorative", () => {
    render(<HomeScreen {...base} onAnnouncements={noop} unreadAnnouncements={3} />);
    expect(screen.getByLabelText("Announcements, 3 unread")).toBeTruthy();
  });
});

describe("HomeScreen roadside balance", () => {
  const roadsideBase = {
    firstName: "Rielle",
    vehicle: null,
    onAddVehicle: jest.fn(),
    onUpdateOdometer: jest.fn(),
    onRoadside: jest.fn(),
  };

  it("names the remaining call-outs when the balance is known", () => {
    render(<HomeScreen {...roadsideBase} roadsideCallouts={2} />);
    screen.getByText("2 call-outs left this cycle");
  });

  it("falls back to the generic line when the balance is unknown", () => {
    render(<HomeScreen {...roadsideBase} roadsideCallouts={null} />);
    screen.getByText("24/7 emergency help");
  });

  // Out of cover is not the same as no cover: the card must still be reachable
  // so the member can see the paid alternative (FR-035).
  it("still offers roadside at zero remaining", () => {
    render(<HomeScreen {...roadsideBase} roadsideCallouts={0} />);
    screen.getByText("0 call-outs left this cycle");
    expect(screen.getByTestId("quick-roadside")).toBeTruthy();
  });
});
