import { useState } from "react";
import { Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { FormField } from "../../components/FormField";
import { Button } from "../../components/Button";

export interface StaffLoginScreenProps {
  error: string | null;
  onSubmit: (email: string, password: string) => void;
}

export function StaffLoginScreen({ error, onSubmit }: StaffLoginScreenProps) {
  const t = fieldTheme;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis, padding: t.spacing.lg, justifyContent: "center", gap: t.spacing.md }}>
      <View>
        <Text style={{ ...t.text("h1"), color: t.colors.primaryDeep }}>Staff sign-in</Text>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>AutoCare+ Field</Text>
      </View>

      <FormField
        testID="staff-email"
        accessibilityLabel="Staff email"
        placeholder="Staff email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <FormField
        testID="staff-password"
        accessibilityLabel="Password"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={error ?? undefined}
        errorTestID="staff-login-error"
      />

      <Button testID="staff-login-submit" onPress={() => onSubmit(email, password)}>
        Sign in
      </Button>
    </View>
  );
}
