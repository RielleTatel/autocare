import { render } from "@testing-library/react-native";
import { IncidentMap } from "./IncidentMap";

jest.mock("@rnmapbox/maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(View, { testID: name, ...props }, props.children as React.ReactNode);
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn() },
    MapView: Passthrough("map-view"),
    Camera: Passthrough("camera"),
    PointAnnotation: Passthrough("point-annotation"),
  };
});

describe("IncidentMap", () => {
  it("centres the camera on the incident", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9214} lng={122.079} editable={false} />);
    // Mapbox takes lng,lat — same trap as the geocoding call.
    expect(getByTestId("camera").props.defaultSettings.centerCoordinate).toEqual([122.079, 6.9214]);
  });

  // Dragging a pin fights the map's own pan gesture. The whole map moves under
  // a fixed crosshair instead, which is how every maps app does this.
  it("pins a fixed crosshair over the map when editable", () => {
    const { getByTestId, queryByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={jest.fn()} />);
    expect(getByTestId("incident-crosshair")).toBeTruthy();
    expect(queryByTestId("point-annotation")).toBeNull();
  });

  it("reports the map's centre when the map settles, as lat,lng in our order", () => {
    const onMove = jest.fn();
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={onMove} />);
    getByTestId("map-view").props.onMapIdle({ properties: { center: [122.5, 7.1] } });
    expect(onMove).toHaveBeenCalledWith(7.1, 122.5);
  });

  // A read-only map is a picture of where help is going; it needs a marker on
  // the spot, not a crosshair inviting a move.
  it("shows a static marker and no crosshair when not editable", () => {
    const { getByTestId, queryByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable={false} />);
    expect(getByTestId("point-annotation")).toBeTruthy();
    expect(queryByTestId("incident-crosshair")).toBeNull();
  });

  it("does not report movement on a read-only map", () => {
    const onMove = jest.fn();
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable={false} onMove={onMove} />);
    expect(getByTestId("map-view").props.onMapIdle).toBeUndefined();
    expect(onMove).not.toHaveBeenCalled();
  });

  // The map lives inside a ScrollView; without this the parent steals every
  // vertical pan and the page scrolls instead of the map moving.
  it("tells the screen when a pan starts and ends, so the page can stop scrolling", () => {
    const onInteractionStart = jest.fn();
    const onInteractionEnd = jest.fn();
    const { getByTestId } = render(
      <IncidentMap
        lat={6.9}
        lng={122.0}
        editable
        onMove={jest.fn()}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />,
    );
    const wrapper = getByTestId("incident-map-wrapper");
    wrapper.props.onTouchStart();
    expect(onInteractionStart).toHaveBeenCalled();
    wrapper.props.onTouchEnd();
    expect(onInteractionEnd).toHaveBeenCalled();
  });
});
