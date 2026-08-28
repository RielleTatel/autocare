import { Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { fieldTheme } from "../theme";

/** Uppercase label + sunken input + sentence-form error (never a code). */
export function FormField({
  label, value, placeholder, error, hint, mono, multiline, keyboardType, onChangeText, testID, accessibilityLabel,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onChangeText?: (value: string) => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = fieldTheme;
  const height = t.minTarget;
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={t.colors.inkMuted}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          height: multiline ? undefined : height,
          minHeight: height,
          backgroundColor: t.colors.surface,
          borderWidth: t.borders.hairline,
          borderColor: error ? t.colors.danger : t.colors.line,
          borderRadius: t.radii.md,
          paddingHorizontal: t.spacing.md,
          paddingVertical: multiline ? t.spacing.md : undefined,
          color: t.colors.ink,
          ...t.text(mono ? "code" : "body"),
          ...(mono ? { letterSpacing: 2 } : null),
        }}
      />
      {error ? (
        <Text style={{ ...t.text("label"), color: t.colors.danger }}>{error}</Text>
      ) : hint ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
