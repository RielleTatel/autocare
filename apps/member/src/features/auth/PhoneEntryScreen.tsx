import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";

const PH_MOBILE = /^9\d{9}$/; // local part after +63

export function PhoneEntryScreen({ onSubmit, onGoogle, error }:
  { onSubmit: (e164: string) => void; onGoogle: () => void; error?: string | null }) {
  const [digits, setDigits] = useState("");
  const valid = PH_MOBILE.test(digits);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Your mobile number</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
        We'll text a 6-digit code to verify it's you.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface,
                     borderRadius: theme.radii.sm, borderWidth: 1, borderColor: theme.colors.line }}>
        <Text style={[theme.text("body"), { paddingHorizontal: theme.spacing.sm, color: theme.colors.ink }]}>+63</Text>
        <TextInput placeholder="917 123 4567" keyboardType="number-pad" maxLength={10}
          value={digits} onChangeText={(t) => setDigits(t.replace(/\D/g, ""))}
          style={[theme.text("body"), { flex: 1, height: theme.minTarget }]} testID="phone-input" />
      </View>
      <Pressable testID="continue" disabled={!valid} accessibilityState={{ disabled: !valid }}
        onPress={() => onSubmit(`+63${digits}`)}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.md,
                 backgroundColor: valid ? theme.colors.primary : theme.colors.line,
                 alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Continue</Text>
      </Pressable>
      <Pressable onPress={onGoogle} testID="google"
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}>
        <Text style={[theme.text("body"), { color: theme.colors.primary }]}>Continue with Google</Text>
      </Pressable>
      {error ? (
        <Text testID="error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.sm }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
