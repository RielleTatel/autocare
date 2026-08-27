import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // Firebase Auth minimum.

export function EmailAuthScreen({
  onSignIn,
  onRegister,
  onGoogle,
  onForgotPassword,
  error,
  notice,
}: {
  onSignIn: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  onGoogle: () => void;
  onForgotPassword: (email: string) => void;
  error?: string | null;
  notice?: string | null;
}) {
  const [mode, setMode] = useState<"SIGN_IN" | "REGISTER">("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = EMAIL.test(email) && password.length >= MIN_PASSWORD;
  const isRegister = mode === "REGISTER";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>
        {isRegister ? "Create your account" : "Sign in"}
      </Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
        {isRegister ? "We'll email you a link to verify your address." : "Use your email and password."}
      </Text>

      <TextInput
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        value={email}
        onChangeText={(t) => setEmail(t.trim())}
        testID="email-input"
        style={[theme.text("body"), {
          height: theme.minTarget, backgroundColor: theme.colors.surface, borderRadius: theme.radii.sm,
          borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: theme.spacing.sm, color: theme.colors.ink,
        }]}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        textContentType={isRegister ? "newPassword" : "password"}
        value={password}
        onChangeText={setPassword}
        testID="password-input"
        style={[theme.text("body"), {
          height: theme.minTarget, backgroundColor: theme.colors.surface, borderRadius: theme.radii.sm,
          borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: theme.spacing.sm, color: theme.colors.ink,
          marginTop: theme.spacing.sm,
        }]}
      />

      <Pressable
        testID="submit"
        disabled={!valid}
        accessibilityState={{ disabled: !valid }}
        onPress={() => (isRegister ? onRegister(email, password) : onSignIn(email, password))}
        style={{
          height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.md,
          backgroundColor: valid ? theme.colors.primary : theme.colors.line, alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={[theme.text("body", 600), { color: theme.colors.onPrimary }]}>
          {isRegister ? "Create account" : "Sign in"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onGoogle}
        testID="google"
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}
      >
        <Text style={[theme.text("body"), { color: theme.colors.primary }]}>Continue with Google</Text>
      </Pressable>

      {!isRegister ? (
        <Pressable testID="forgot-password" onPress={() => onForgotPassword(email)}
          style={{ alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}>
          <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Forgot password?</Text>
        </Pressable>
      ) : null}

      <Pressable testID="toggle-mode" onPress={() => setMode(isRegister ? "SIGN_IN" : "REGISTER")}
        style={{ alignItems: "center", justifyContent: "center", marginTop: theme.spacing.md }}>
        <Text style={[theme.text("label"), { color: theme.colors.primary }]}>
          {isRegister ? "Already have an account? Sign in" : "New here? Create an account"}
        </Text>
      </Pressable>

      {error ? (
        <Text testID="error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.sm }]}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text testID="notice" style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
