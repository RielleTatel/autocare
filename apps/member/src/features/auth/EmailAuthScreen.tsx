import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // Firebase Auth minimum.

const signInIllustration = require("../../../assets/auth/sign-in.png");
const signUpIllustration = require("../../../assets/auth/sign-up.png");

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
  onSignIn: (email: string, password: string) => void | Promise<void>;
  onRegister: (email: string, password: string) => void | Promise<void>;
  onGoogle: () => void | Promise<void>;
  onForgotPassword: (email: string) => void | Promise<void>;
  error?: string | null;
  notice?: string | null;
}) {
  const [mode, setMode] = useState<"SIGN_IN" | "REGISTER">("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [focusedField, setFocusedField] = useState<"EMAIL" | "PASSWORD" | null>(null);
  const [pending, setPending] = useState<"SUBMIT" | "GOOGLE" | "RESET" | null>(null);
  const pendingRef = useRef(false);
  const valid = EMAIL.test(email) && password.length >= MIN_PASSWORD;
  const isRegister = mode === "REGISTER";
  const busy = pending !== null;
  const t = theme;

  const run = async (action: NonNullable<typeof pending>, work: () => void | Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(action);
    try {
      await work();
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };

  const inputStyle = (focused: boolean) => ({
    height: 52,
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.sm,
    borderWidth: focused ? t.borders.control : t.borders.hairline,
    borderColor: focused ? t.colors.primary : t.colors.line,
    paddingHorizontal: t.spacing.md,
    color: t.colors.ink,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.surface }}
      contentContainerStyle={{
        flexGrow: 1,
        width: "100%",
        maxWidth: 440,
        alignSelf: "center",
        paddingHorizontal: t.spacing.lg,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: "center" }}>
        <Image
          testID="auth-illustration"
          source={isRegister ? signUpIllustration : signInIllustration}
          accessible={false}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={{ width: 164, height: 164 }}
        />

        <Text
          testID="auth-heading"
          accessibilityRole="header"
          style={[t.text("h1"), { color: t.colors.primaryDeep, textAlign: "center" }]}
        >
          {isRegister ? "Create your account" : "Welcome back"}
        </Text>
        <Text
          style={[
            t.text("body"),
            { color: t.colors.inkMuted, textAlign: "center", lineHeight: 24, marginTop: t.spacing.xs },
          ]}
        >
          {isRegister
            ? "Sign up to keep your vehicle care in one place."
            : "Sign in to keep your vehicle care on track."}
        </Text>
      </View>

      <View style={{ gap: t.spacing.md, marginTop: t.spacing.lg }}>
        <View>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            placeholder="Enter your email"
            placeholderTextColor={t.colors.inkMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            editable={!busy}
            value={email}
            onChangeText={(v) => setEmail(v.trim())}
            onFocus={() => setFocusedField("EMAIL")}
            onBlur={() => setFocusedField(null)}
            testID="email-input"
            style={[t.text("body"), inputStyle(focusedField === "EMAIL")]}
          />
        </View>

        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <FieldLabel>Password</FieldLabel>
            {!isRegister ? (
              <Pressable
                testID="forgot-password"
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !EMAIL.test(email), busy: pending === "RESET" }}
                disabled={busy || !EMAIL.test(email)}
                onPress={() => void run("RESET", () => onForgotPassword(email))}
                hitSlop={8}
                style={{ marginBottom: 6 }}
              >
                <Text
                  style={[
                    t.text("label", 600),
                    { color: EMAIL.test(email) ? t.colors.primary : t.colors.inkFaint },
                  ]}
                >
                  {pending === "RESET" ? "Sending reset link…" : "Forgot password?"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ position: "relative", justifyContent: "center" }}>
            <TextInput
              placeholder={isRegister ? "Create a password" : "Enter your password"}
              placeholderTextColor={t.colors.inkMuted}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              textContentType={isRegister ? "newPassword" : "password"}
              editable={!busy}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("PASSWORD")}
              onBlur={() => setFocusedField(null)}
              testID="password-input"
              style={[
                t.text("body"),
                inputStyle(focusedField === "PASSWORD"),
                { paddingRight: 52 },
              ]}
            />
            <Pressable
              testID="toggle-password"
              accessibilityRole="button"
              accessibilityLabel={reveal ? "Hide password" : "Show password"}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => setReveal((r) => !r)}
              style={{
                position: "absolute",
                right: 0,
                height: 52,
                width: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={reveal ? "eye-off" : "eye"} size={20} color={t.colors.inkMuted} />
            </Pressable>
          </View>
          {isRegister ? (
            <Text style={[t.text("label"), { color: t.colors.inkMuted, marginTop: 6 }]}>Use at least 6 characters.</Text>
          ) : null}
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: "#FBE9E7",
              borderRadius: t.radii.sm,
              padding: t.spacing.sm,
            }}
          >
            <Text testID="error" style={[t.text("label"), { color: t.colors.danger }]}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View
            style={{
              backgroundColor: t.colors.surfaceSoft,
              borderRadius: t.radii.sm,
              padding: t.spacing.sm,
            }}
          >
            <Text testID="notice" style={[t.text("label"), { color: t.colors.inkMuted }]}>{notice}</Text>
          </View>
        ) : null}

        <Button
          block
          testID="submit"
          disabled={!valid || (busy && pending !== "SUBMIT")}
          loading={pending === "SUBMIT"}
          onPress={() => void run("SUBMIT", () => (
            isRegister ? onRegister(email, password) : onSignIn(email, password)
          ))}
        >
          {pending === "SUBMIT"
            ? isRegister ? "Creating account…" : "Signing in…"
            : isRegister ? "Create account" : "Sign in"}
        </Button>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: t.spacing.sm,
          marginVertical: t.spacing.lg,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
      </View>

      <Button
        block
        variant="secondary"
        testID="google"
        disabled={busy && pending !== "GOOGLE"}
        loading={pending === "GOOGLE"}
        onPress={() => void run("GOOGLE", onGoogle)}
      >
        {pending === "GOOGLE" ? "Connecting to Google…" : "Continue with Google"}
      </Button>

      <Pressable
        testID="toggle-mode"
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => {
          setMode(isRegister ? "SIGN_IN" : "REGISTER");
          setPassword("");
          setReveal(false);
        }}
        style={{
          minHeight: t.minTarget,
          alignItems: "center",
          justifyContent: "center",
          marginTop: "auto",
        }}
      >
        <Text style={[t.text("label"), { color: t.colors.inkMuted, textAlign: "center" }]}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <Text style={[t.text("label", 600), { color: t.colors.primary }]}>
            {isRegister ? "Sign in" : "Sign up"}
          </Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}
