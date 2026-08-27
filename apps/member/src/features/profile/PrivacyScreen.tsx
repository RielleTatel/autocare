import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { PRIVACY_POLICY } from "../auth/privacy-policy";

const POLICY_VERSION = process.env.EXPO_PUBLIC_POLICY_VERSION ?? "1";

export function PrivacyScreen({ requestDataExport, requestDeletion, onSignedOut }: {
  requestDataExport: () => Promise<unknown>;
  requestDeletion: () => Promise<unknown>;
  onSignedOut: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const downloadData = async () => {
    await requestDataExport();
    setToast("We'll prepare your export — check back in Profile");
  };

  const deleteAccount = async () => {
    await requestDeletion();
    setConfirmDelete(false);
    onSignedOut();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Privacy & data</Text>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
        Policy version {POLICY_VERSION}
      </Text>
      <Text style={[theme.text("body"), { color: theme.colors.ink, marginTop: theme.spacing.md }]}>
        {PRIVACY_POLICY}
      </Text>

      <Button block style={{ marginTop: theme.spacing.lg }} testID="download-data" onPress={downloadData}>
        Download my data
      </Button>
      {toast ? (
        <Text testID="toast" style={[theme.text("label"), { color: theme.colors.success, marginTop: theme.spacing.sm }]}>
          {toast}
        </Text>
      ) : null}

      <Pressable testID="delete-account" onPress={() => setConfirmDelete(true)}
        style={{ height: theme.minTarget, justifyContent: "center", marginTop: theme.spacing.lg }}>
        <Text style={[theme.text("body"), { color: theme.colors.danger }]}>Delete my account</Text>
      </Pressable>

      {confirmDelete && (
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
          marginTop: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line }}>
          <Text style={[theme.text("body"), { color: theme.colors.ink }]}>
            Deleting your account anonymizes your personal data; vehicle and service history are retained in
            anonymized form for warranty and regulatory records. This can't be undone.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Pressable testID="delete-cancel" onPress={() => setConfirmDelete(false)}
              style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
              <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable testID="delete-confirm" onPress={deleteAccount}
              style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
              <Text style={[theme.text("body", 600), { color: theme.colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
