import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme, familyForRole } from "../../theme";
import { Button } from "../../components/Button";
import { PRIVACY_POLICY } from "./privacy-policy";
import { api } from "../../shared/api";

const POLICY_VERSION = process.env.EXPO_PUBLIC_POLICY_VERSION ?? "1";

export function ConsentScreen({ onConsented }: { onConsented: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep, marginBottom: theme.spacing.sm }]}>
          Privacy policy
        </Text>
        <Text style={[theme.text("label"), { fontFamily: familyForRole("code"), color: theme.colors.inkMuted,
          marginBottom: theme.spacing.md }]}>
          Policy version {POLICY_VERSION}
        </Text>
        <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{PRIVACY_POLICY}</Text>
      </ScrollView>
      {error ? (
        <Text style={[theme.text("label"), { color: theme.colors.danger, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm }]}>
          {error}
        </Text>
      ) : null}
      <Button
        block
        style={{ marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg }}
        testID="agree"
        onPress={async () => {
          setError(null);
          try {
            await api.post("/auth/consent", { policyVersion: POLICY_VERSION });
            onConsented();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't save your consent. Try again.");
          }
        }}
      >
        I agree
      </Button>
    </View>
  );
}
