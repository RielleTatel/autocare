import { fireEvent, render } from "@testing-library/react-native";
import { RoadsideStatusScreen } from "./RoadsideStatusScreen";

jest.mock("./IncidentMap", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    IncidentMap: (props: Record<string, unknown>) => React.createElement(View, { testID: "incident-map", ...props }),
  };
});

const req = (over = {}) => ({
  id: "rr-1",
  vehicleId: "veh-1",
  incidentType: "FLAT_TYRE" as const,
  lat: 6.9214,
  lng: 122.079,
  address: "Governor Camins Ave",
  landmarkNote: null,
  status: "EN_ROUTE" as const,
  responderName: "J. Cruz",
  etaMinutes: 20,
  createdAt: "2026-06-01T00:00:00.000Z",
  resolvedAt: null,
  ...over,
});

describe("RoadsideStatusScreen (M-27)", () => {
  it("shows every step of the timeline", () => {
    const { getByText } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    for (const step of ["Requested", "Acknowledged", "Dispatched", "On the way", "On site", "Resolved"]) {
      getByText(step);
    }
  });

  it("marks steps already passed as done and names the current one", () => {
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    expect(getByTestId("step-REQUESTED").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("step-EN_ROUTE").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("step-ON_SITE").props.accessibilityState.selected).toBe(false);
  });

  it("names the responder and the ETA when one has been assigned", () => {
    const { getByText } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    getByText("J. Cruz");
    getByText(/20 min/);
  });

  // The map is read-only here: once the request is in, the location is settled.
  it("shows the incident location on a locked map", () => {
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    expect(getByTestId("incident-map").props.editable).toBe(false);
    expect(getByTestId("incident-map").props.lat).toBe(6.9214);
  });

  // A stale poll must be visible, not silent — the member is deciding whether
  // to keep waiting or call.
  it("says when the status may be out of date", () => {
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    expect(getByTestId("roadside-stale")).toBeTruthy();
  });

  it("offers the hotline throughout (FR-040)", () => {
    const onCallHotline = jest.fn();
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={onCallHotline} onOpenInMaps={jest.fn()} />,
    );
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(onCallHotline).toHaveBeenCalled();
  });

  it("closes the loop when resolved", () => {
    const { getByText } = render(
      <RoadsideStatusScreen
        request={req({ status: "RESOLVED", resolvedAt: "2026-06-01T01:00:00.000Z" })}
        stale={false}
        onCallHotline={jest.fn()}
        onOpenInMaps={jest.fn()}
      />,
    );
    getByText(/sorted/i);
  });
});
