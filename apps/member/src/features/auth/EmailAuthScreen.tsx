import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // Firebase Auth minimum.

const logoMark = require("../../../assets/logo-mark.png");

/** Label above a field. Hierarchy the placeholder alone cannot carry: a
 *  placeholder disappears the moment you type, taking the field's name with it. */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginBottom: 6 }]}>
      {children}
    </Text>
  );
}

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
  const [reveal, setReveal] = useState(false);
  const valid = EMAIL.test(email) && password.length >= MIN_PASSWORD;
  const isRegister = mode === "REGISTER";
  const t = theme;

  const inputStyle = {
    height: t.minTarget,
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.sm,
    borderWidth: 1,
    borderColor: t.colors.line,
    paddingHorizontal: t.spacing.sm,
    color: t.colors.ink,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Masthead, echoing Home: the mark and a Barlow line. The screen now
          opens with the product rather than a gap above a form. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
        <Image source={logoMark} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <View style={{ flex: 1 }}>
          <Text testID="auth-heading" style={[t.text("h1"), { color: t.colors.primaryDeep }]}>
            {isRegister ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
            {isRegister ? "We'll email you a link to verify your address." : "Your vehicle care, all in one place."}
          </Text>
        </View>
      </View>

      <View style={{ gap: t.spacing.md }}>
        <View>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor={t.colors.inkMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            value={email}
            onChangeText={(v) => setEmail(v.trim())}
            testID="email-input"
            style={[t.text("body"), inputStyle]}
          />
        </View>

        <View>
          <FieldLabel>Password</FieldLabel>
          {/* The toggle sits inside the field's frame rather than beside it, so
              the control belongs to the input it acts on. */}
          <View style={{ position: "relative", justifyContent: "center" }}>
            <TextInput
              placeholder={isRegister ? "At least 6 characters" : "Your password"}
              placeholderTextColor={t.colors.inkMuted}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              textContentType={isRegister ? "newPassword" : "password"}
              value={password}
              onChangeText={setPassword}
              testID="password-input"
              style={[t.text("body"), inputStyle, { paddingRight: t.minTarget }]}
            />
            <Pressable
              testID="toggle-password"
              accessibilityRole="button"
              accessibilityLabel={reveal ? "Hide password" : "Show password"}
              onPress={() => setReveal((r) => !r)}
              style={{
                position: "absolute",
                right: 0,
                height: t.minTarget,
                width: t.minTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={reveal ? "eye-off" : "eye"} size={20} color={t.colors.inkMuted} />
            </Pressable>
          </View>
        </View>

        <Button
          block
          testID="submit"
          disabled={!valid}
          onPress={() => (isRegister ? onRegister(email, password) : onSignIn(email, password))}
        >
          {isRegister ? "Create account" : "Sign in"}
        </Button>

        {!isRegister ? (
          <Pressable
            testID="forgot-password"
            onPress={() => onForgotPassword(email)}
            style={{ minHeight: t.minTarget, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={[t.text("label"), { color: t.colors.primary }]}>Forgot password?</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Federated auth is a different route to the same place, not another
          field — the rule says so without a word of explanation. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
      </View>

      <Button block variant="secondary" testID="google" onPress={onGoogle}>
        Continue with Google
      </Button>

      <Pressable
        testID="toggle-mode"
        onPress={() => setMode(isRegister ? "SIGN_IN" : "REGISTER")}
        style={{ minHeight: t.minTarget, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
          {isRegister ? "Already have an account? " : "New here? "}
          <Text style={[t.text("label", 600), { color: t.colors.primary }]}>
            {isRegister ? "Sign in" : "Create an account"}
          </Text>
        </Text>
      </Pressable>

      {error ? (
        <Text testID="error" style={[t.text("label"), { color: t.colors.danger }]}>{error}</Text>
      ) : null}
      {notice ? (
        <Text testID="notice" style={[t.text("label"), { color: t.colors.inkMuted }]}>{notice}</Text>
      ) : null}
    </ScrollView>
  );
}
