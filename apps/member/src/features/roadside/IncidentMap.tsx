import Mapbox, { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import { View } from "react-native";
import { theme } from "../../theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

type Props = {
  lat: number;
  lng: number;
  editable: boolean;
  onMove?: (lat: number, lng: number) => void;
  /** Fired when a pan begins/ends so the parent can stop its own scrolling. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

const PIN_SIZE = 22;

/**
 * FR-032 / D-3 — the member's chance to correct a GPS fix before help is sent.
 *
 * The pin does not move; the map does. A draggable pin competes with the map's
 * own pan gesture — the finger is doing two jobs — and on a phone that reads as
 * a map fighting back. A fixed crosshair with the map sliding underneath is the
 * pattern every maps app uses, and it is far easier one-handed, which is the
 * posture of somebody stranded at the roadside.
 */
export function IncidentMap({ lat, lng, editable, onMove, onInteractionStart, onInteractionEnd }: Props) {
  return (
    <View
      testID="incident-map-wrapper"
      // The map sits inside a ScrollView. Without handing these up, every
      // vertical pan is stolen by the parent and the page scrolls instead.
      onTouchStart={onInteractionStart}
      onTouchEnd={onInteractionEnd}
      onTouchCancel={onInteractionEnd}
      style={{ height: 220, borderRadius: theme.radii.md, overflow: "hidden" }}
    >
      {/* logoEnabled stays on — Mapbox's terms require the attribution. */}
      <MapView
        style={{ flex: 1 }}
        scaleBarEnabled={false}
        logoEnabled
        onMapIdle={
          editable
            ? (state: { properties: { center: number[] } }) => {
                const [cLng, cLat] = state.properties.center;
                onMove?.(cLat, cLng);
              }
            : undefined
        }
      >
        {/* defaultSettings, not centerCoordinate: a controlled camera would
            snap back to the prop mid-pan and the map would feel stuck. */}
        <Camera defaultSettings={{ centerCoordinate: [lng, lat], zoomLevel: 16 }} animationDuration={0} />
        {!editable ? (
          <PointAnnotation id="incident" coordinate={[lng, lat]}>
            <View
              style={{
                width: PIN_SIZE,
                height: PIN_SIZE,
                borderRadius: PIN_SIZE / 2,
                backgroundColor: theme.colors.danger,
                borderWidth: 3,
                borderColor: "#FFFFFF",
              }}
            />
          </PointAnnotation>
        ) : null}
      </MapView>

      {editable ? (
        <View
          testID="incident-crosshair"
          // Decorative and non-interactive: every touch belongs to the map.
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: PIN_SIZE,
              height: PIN_SIZE,
              borderRadius: PIN_SIZE / 2,
              backgroundColor: theme.colors.danger,
              borderWidth: 3,
              borderColor: "#FFFFFF",
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
