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
    // Mapbox takes lng,lat — same trap as Task 8.
    expect(getByTestId("camera").props.centerCoordinate).toEqual([122.079, 6.9214]);
  });

  it("lets the member drag the pin when editable", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={jest.fn()} />);
    expect(getByTestId("point-annotation").props.draggable).toBe(true);
  });

  it("locks the pin when not editable", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable={false} />);
    expect(getByTestId("point-annotation").props.draggable).toBe(false);
  });

  it("reports the dragged position as lat,lng in our order, not Mapbox's", () => {
    const onMove = jest.fn();
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={onMove} />);
    getByTestId("point-annotation").props.onDragEnd({ geometry: { coordinates: [122.5, 7.1] } });
    expect(onMove).toHaveBeenCalledWith(7.1, 122.5);
  });
});
