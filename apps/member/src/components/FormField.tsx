import { Text, TextInput, View } from "react-native";
import { theme } from "../theme";

/** Uppercase label + sunken input + sentence-form error (never a code). */
export function FormField({
  label, value, placeholder, error, hint, mono, size = "member", onChangeText, testID,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  size?: "member" | "field";
  onChangeText?: (value: string) => void;
  testID?: string;
}) {
  const height = size === "field" ? 56 : theme.minTarget;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        onChangeText={onChangeText}
        style={{
          height,
          minHeight: height,
          backgroundColor: theme.colors.chassis,
          borderWidth: 1,
          borderColor: error ? theme.colors.danger : theme.colors.line,
          borderRadius: theme.radii.sm,
          paddingHorizontal: theme.spacing.md,
          color: theme.colors.ink,
          fontFamily: mono ? "IBMPlexMono_500Medium" : undefined,
          letterSpacing: mono ? 2 : undefined,
        }}
      />
      {error ? (
        <Text style={{ ...theme.text("label"), color: theme.colors.danger }}>{error}</Text>
      ) : hint ? (
        <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
