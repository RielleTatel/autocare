import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { FormField } from "../../components/FormField";
import { Button } from "../../components/Button";

export interface StaffLoginScreenProps {
  error: string | null;
  onSubmit: (email: string, password: string) => void | Promise<void>;
}

export function StaffLoginScreen({ error, onSubmit }: StaffLoginScreenProps) {
  const t = fieldTheme;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: t.spacing.lg }}>
    <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: t.spacing.md }}>
      <View>
        <Text style={{ ...t.text("h1"), color: t.colors.primaryDeep }}>Staff sign-in</Text>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>AutoCare+ Field</Text>
      </View>

      <FormField
        testID="staff-email"
        accessibilityLabel="Staff email"
        placeholder="Staff email"
        label="Staff email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <FormField
        testID="staff-password"
        accessibilityLabel="Password"
        placeholder="Password"
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={error ?? undefined}
        errorTestID="staff-login-error"
      />

      <Button testID="staff-login-submit" disabled={submitting || !email.trim() || !password} onPress={() => { if (submitting) return; setSubmitting(true); void Promise.resolve(onSubmit(email.trim(), password)).finally(() => setSubmitting(false)); }}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </View>
    </ScrollView>
  );
}
