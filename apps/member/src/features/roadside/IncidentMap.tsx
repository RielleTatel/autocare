import Mapbox, { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import { View } from "react-native";
import { theme } from "../../theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

type Props = {
  lat: number;
  lng: number;
  editable: boolean;
  onMove?: (lat: number, lng: number) => void;
};

/**
 * FR-032 / D-3. When `editable`, the pin is the member's correction channel for
 * GPS drift — under a covered car park a raw fix can be tens of metres out, and
 * this is the difference between a dispatch and a phone call.
 *
 * The pin takes `colors.danger`, not the CRITICAL band fill: band colours carry
 * score meaning only (design principle 1), and an incident is not a score.
 */
export function IncidentMap({ lat, lng, editable, onMove }: Props) {
  return (
    <View style={{ height: 220, borderRadius: theme.radii.md, overflow: "hidden" }}>
      {/* logoEnabled stays on — Mapbox's terms require the attribution. */}
      <MapView style={{ flex: 1 }} scaleBarEnabled={false} logoEnabled>
        <Camera centerCoordinate={[lng, lat]} zoomLevel={16} animationDuration={0} />
        <PointAnnotation
          id="incident"
          coordinate={[lng, lat]}
          draggable={editable}
          onDragEnd={(f: { geometry: { coordinates: number[] } }) => {
            const [dLng, dLat] = f.geometry.coordinates;
            onMove?.(dLat, dLng);
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.colors.danger,
              borderWidth: 3,
              borderColor: "#FFFFFF",
            }}
          />
        </PointAnnotation>
      </MapView>
    </View>
  );
}
