import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";

const MAX_PHOTOS = 6;
const MAX_ORCR = 2;

export function VehiclePhotosScreen({ vehicleId, initialPhotoUrls = [], initialOrCrUrls = [], onDone, pickImage, uploadPhoto, patchVehicle }: {
  vehicleId: string;
  initialPhotoUrls?: string[];
  initialOrCrUrls?: string[];
  onDone: () => void;
  pickImage: () => Promise<string | null>;
  uploadPhoto: (vehicleId: string, localUri: string, kind: "PHOTO" | "ORCR") => Promise<string>;
  patchVehicle: (id: string, body: { photoUrls: string[]; orCrUrls: string[] }) => Promise<unknown>;
}) {
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialPhotoUrls);
  const [orCrUrls, setOrCrUrls] = useState<string[]>(initialOrCrUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State updates are not synchronous, so keep an immediate lock as well. This
  // prevents two quick taps from launching Android's single activity contract
  // twice before the disabled prop has rendered.
  const actionInFlight = useRef(false);

  const addPhoto = async (kind: "PHOTO" | "ORCR") => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      // Picking can reject before an asset is returned (for example if Android
      // recreated the host Activity and its launcher is not registered yet), so
      // it must live inside the same error boundary as the upload.
      const uri = await pickImage();
      if (!uri) return;

      const publicUrl = await uploadPhoto(vehicleId, uri, kind);
      if (kind === "PHOTO") setPhotoUrls((u) => [...u, publicUrl]);
      else setOrCrUrls((u) => [...u, publicUrl]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        message.includes("unregistered ActivityResultLauncher")
          ? "The photo library isn't ready. Restart AutoCare+ and try again."
          : message || "Couldn't add that photo — try again."
      );
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await patchVehicle(vehicleId, { photoUrls, orCrUrls });
      onDone();
    } catch {
      setError("Couldn't save photos — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Add photos</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
        Optional — you can add these later from the vehicle detail screen.
      </Text>

      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Vehicle photos ({photoUrls.length}/{MAX_PHOTOS})</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {photoUrls.map((url) => (
          <Image key={url} source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: theme.radii.sm }} />
        ))}
        {photoUrls.length < MAX_PHOTOS && (
          <Pressable testID="add-photo" disabled={busy} onPress={() => addPhoto("PHOTO")}
            style={{ width: 88, height: 88, borderRadius: theme.radii.sm, borderWidth: 1, borderStyle: "dashed",
              borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }}>
            <Text style={[theme.text("body"), { color: theme.colors.primary }]}>+</Text>
          </Pressable>
        )}
      </View>

      <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.lg }]}>
        OR/CR photos ({orCrUrls.length}/{MAX_ORCR})
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {orCrUrls.map((url) => (
          <Image key={url} source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: theme.radii.sm }} />
        ))}
        {orCrUrls.length < MAX_ORCR && (
          <Pressable testID="add-orcr" disabled={busy} onPress={() => addPhoto("ORCR")}
            style={{ width: 88, height: 88, borderRadius: theme.radii.sm, borderWidth: 1, borderStyle: "dashed",
              borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }}>
            <Text style={[theme.text("body"), { color: theme.colors.primary }]}>+</Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <Text testID="error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>
          {error}
        </Text>
      ) : null}

      {busy ? <ActivityIndicator testID="activity-indicator" style={{ marginTop: theme.spacing.md }} /> : null}

      <Button block style={{ marginTop: theme.spacing.lg }} testID="done" disabled={busy} onPress={finish}>
        Done
      </Button>
      <Pressable testID="skip" disabled={busy} onPress={onDone}
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}
