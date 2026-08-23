import { useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Circle, Line, Polygon } from "react-native-svg";
import { fieldTheme } from "../../theme";
import { compressForUpload } from "../../shared/sync/photos";

type Mark = { kind: "arrow" | "circle"; x: number; y: number };

/** F-07 — capture → simple arrow/circle annotation overlay → compressed URI.
 *  Marks are burned in metadata-free (positions overlaid at render on review);
 *  the compressed JPEG itself is what uploads (≤500 KB, NFR-006). */
export function PhotoAnnotateScreen({ onDone, onCancel }: { onDone(uri: string, marks: Mark[]): void; onCancel(): void }) {
  const t = fieldTheme;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tool, setTool] = useState<Mark["kind"]>("arrow");
  const [marks, setMarks] = useState<Mark[]>([]);

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center", padding: t.spacing.lg, gap: t.spacing.md }}>
        <Text style={[t.text("body"), { color: t.colors.ink, textAlign: "center" }]}>Camera access is needed to photograph findings.</Text>
        <Pressable accessibilityRole="button" onPress={requestPermission} style={{ minHeight: t.minTarget, paddingHorizontal: t.spacing.lg, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Allow camera</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel}><Text style={[t.text("body"), { color: t.colors.primary }]}>Cancel</Text></Pressable>
      </View>
    );
  }

  if (!photoUri) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView ref={camera} style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-around", padding: t.spacing.md, backgroundColor: t.colors.primaryDeep }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={{ minHeight: t.minTarget, justifyContent: "center" }}>
            <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={async () => {
              const shot = await camera.current?.takePictureAsync();
              if (shot?.uri) setPhotoUri(shot.uri);
            }}
            style={{ minHeight: t.minTarget, minWidth: t.minTarget, borderRadius: t.radii.pill, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: t.spacing.lg }}
          >
            <Text style={[t.text("h2"), { color: t.colors.primaryDeep }]}>Capture</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          setMarks((m) => [...m, { kind: tool, x: locationX, y: locationY }]);
        }}
      >
        <Svg style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          {marks.map((m, i) =>
            m.kind === "circle" ? (
              <Circle key={i} cx={m.x} cy={m.y} r={36} stroke={t.colors.danger} strokeWidth={4} fill="none" />
            ) : (
              <>
                <Line key={`l${i}`} x1={m.x - 48} y1={m.y + 48} x2={m.x} y2={m.y} stroke={t.colors.danger} strokeWidth={4} />
                <Polygon key={`p${i}`} points={`${m.x},${m.y} ${m.x - 16},${m.y + 6} ${m.x - 6},${m.y + 16}`} fill={t.colors.danger} />
              </>
            ),
          )}
        </Svg>
        <View style={{ flex: 1, backgroundColor: "#222" }}>
          <Image source={{ uri: photoUri }} style={{ flex: 1 }} resizeMode="contain" />
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", padding: t.spacing.md, backgroundColor: t.colors.primaryDeep }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Arrow tool" onPress={() => setTool("arrow")} style={{ minHeight: t.minTarget, justifyContent: "center", opacity: tool === "arrow" ? 1 : 0.6 }}>
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>↗ Arrow</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Circle tool" onPress={() => setTool("circle")} style={{ minHeight: t.minTarget, justifyContent: "center", opacity: tool === "circle" ? 1 : 0.6 }}>
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>◯ Circle</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Retake" onPress={() => { setPhotoUri(null); setMarks([]); }} style={{ minHeight: t.minTarget, justifyContent: "center" }}>
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Retake</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use photo"
          onPress={async () => {
            const compressed = await compressForUpload(photoUri);
            onDone(compressed, marks);
          }}
          style={{ minHeight: t.minTarget, justifyContent: "center" }}
        >
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Use photo ✓</Text>
        </Pressable>
      </View>
    </View>
  );
}
