import { Fragment, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Circle, Line, Polygon } from "react-native-svg";
import { fieldTheme as t } from "../../theme";
import { Icon } from "../../components/Icon";
import { FieldNav } from "../../components/FieldNav";
import { Button } from "../../components/Button";
import { ActionBar, workContent } from "../../components/FieldLayout";
import { compressForUpload } from "../../shared/sync/photos";

type Mark = { kind: "arrow" | "circle"; x: number; y: number };
export function PhotoAnnotateScreen({ onDone, onCancel }: { onDone(uri: string, marks: Mark[]): void | Promise<void>; onCancel(): void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tool, setTool] = useState<Mark["kind"]>("arrow");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prepare = async () => {
    if (busy || !photoUri) return;
    setBusy(true); setError(null);
    try { await onDone(await compressForUpload(photoUri), marks); }
    catch { setError("Could not save this photo. Try again, or return to the finding without it."); }
    finally { setBusy(false); }
  };
  if (!permission?.granted) return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Finding photo" onBack={onCancel} />
    <View style={{ flex: 1, justifyContent: "center" }}><View style={workContent}>
      <Icon name="camera" size={32} color={t.colors.inkMuted} />
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>Add a photo</Text>
      <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Allow camera access to document this finding. Photos are optional.</Text>
      {permission?.canAskAgain === false ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Enable camera access in your device or browser settings, or return to the finding to continue.</Text> : <Button onPress={() => { void requestPermission().catch(() => setError("Camera access is unavailable. Return to the finding to continue.")); }}>Allow camera</Button>}
      {error ? <Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{error}</Text> : null}
    </View></View>
  </View>;
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Finding photo" onBack={onCancel} />
    {!photoUri ? <View style={{ flex: 1, backgroundColor: "#000000", width: "100%", maxWidth: 760, alignSelf: "center" }}><CameraView ref={camera} style={{ flex: 1 }} /></View> : <View style={{ flex: 1, backgroundColor: "#000000", width: "100%", maxWidth: 760, alignSelf: "center" }} onStartShouldSetResponder={() => true} onResponderRelease={(event) => {
      const { locationX, locationY } = event.nativeEvent; setMarks((old) => [...old, { kind: tool, x: locationX, y: locationY }]);
    }}>
      <Image source={{ uri: photoUri }} style={{ flex: 1 }} resizeMode="contain" />
      <Svg pointerEvents="none" style={{ position: "absolute", inset: 0 }}>{marks.map((mark, index) => mark.kind === "circle" ? <Circle key={index} cx={mark.x} cy={mark.y} r={36} stroke={t.colors.danger} strokeWidth={4} fill="none" /> : <Fragment key={index}><Line x1={mark.x - 48} y1={mark.y + 48} x2={mark.x} y2={mark.y} stroke={t.colors.danger} strokeWidth={4} /><Polygon points={`${mark.x},${mark.y} ${mark.x - 16},${mark.y + 6} ${mark.x - 6},${mark.y + 16}`} fill={t.colors.danger} /></Fragment>)}</Svg>
    </View>}
    <ActionBar>
      {error ? <Text accessibilityRole="alert" style={[t.text("label"), { color: t.colors.danger }]}>{error}</Text> : null}
      {photoUri ? <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(["arrow", "circle"] as const).map((kind) => <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`${kind === "arrow" ? "Arrow" : "Circle"} tool`} accessibilityState={{ selected: tool === kind }} onPress={() => setTool(kind)} style={{ flex: 1, minHeight: t.minTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: t.radii.sm, backgroundColor: tool === kind ? t.colors.chassis : t.colors.surface }}><Icon name={kind === "arrow" ? "arrow-up-right" : "circle-dot"} size={20} color={t.colors.ink} /><Text style={[t.text("label"), { color: t.colors.ink }]}>{kind === "arrow" ? "Arrow" : "Circle"}</Text></Pressable>)}
          <Button block={false} variant="ghost" onPress={() => { setPhotoUri(null); setMarks([]); setError(null); }}>Retake</Button>
        </View>
        <Button icon="check" disabled={busy} onPress={() => { void prepare(); }}>{busy ? "Saving photo…" : "Use photo"}</Button>
      </> : <Button icon="camera" disabled={busy} accessibilityLabel="Take photo" onPress={() => { if (busy) return; setBusy(true); setError(null); void camera.current?.takePictureAsync().then((shot) => { if (shot?.uri) setPhotoUri(shot.uri); }).catch(() => setError("Could not take a photo. Try again, or return to the finding.")).finally(() => setBusy(false)); }}>Take photo</Button>}
    </ActionBar>
  </View>;
}
