import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";

export function OtpScreen({ phone, onConfirm, onResend, error }:
  { phone: string; onConfirm: (code: string) => void; onResend: () => void; error?: string | null }) {
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(60);
  useEffect(() => {
    if (secondsLeft === 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft === 0]);
  const handleChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) onConfirm(digits);
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Enter the code</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>Sent to {phone}</Text>
      <TextInput testID="otp-input" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp"
        value={code} onChangeText={handleChange}
        style={[theme.text("score"), { fontFamily: "IBMPlexMono_500Medium", fontSize: 32, letterSpacing: 8,
          backgroundColor: theme.colors.surface, borderRadius: theme.radii.sm, height: theme.minTarget + 8,
          textAlign: "center", borderWidth: 1, borderColor: theme.colors.line }]} />
      <Pressable testID="resend" disabled={secondsLeft > 0} accessibilityState={{ disabled: secondsLeft > 0 }}
        onPress={() => { onResend(); setSecondsLeft(60); }}
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}>
        <Text style={[theme.text("body"), { color: secondsLeft > 0 ? theme.colors.inkMuted : theme.colors.primary }]}>
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
        </Text>
      </Pressable>
      {error ? (
        <Text testID="error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.sm }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
