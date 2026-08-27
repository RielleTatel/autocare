import { Pressable, ScrollView, Text, View } from "react-native";
import { theme, familyForRole } from "../../theme";
import { Button } from "../../components/Button";
import { PRIVACY_POLICY } from "./privacy-policy";
import { api } from "../../shared/api";

const POLICY_VERSION = process.env.EXPO_PUBLIC_POLICY_VERSION ?? "1";

export function ConsentScreen({ onConsented }: { onConsented: () => void }) {
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
      <Button
        block
        style={{ marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg }}
        testID="agree"
        onPress={async () => {
          await api.post("/auth/consent", { policyVersion: POLICY_VERSION });
          onConsented();
        }}
      >
        I agree
      </Button>
    </View>
  );
}
