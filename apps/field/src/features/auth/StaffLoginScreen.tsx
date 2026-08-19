import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fieldTheme } from "../../theme";

export function StaffLoginScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>Staff sign-in</Text>
      <Text style={styles.tagline}>AutoCare+ Field</Text>

      <TextInput
        style={styles.input}
        placeholder="Staff email"
        placeholderTextColor={fieldTheme.colors.inkMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={fieldTheme.colors.inkMuted}
        secureTextEntry
        autoComplete="current-password"
      />

      <Pressable style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonLabel}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: fieldTheme.colors.chassis,
    padding: fieldTheme.spacing.lg,
    justifyContent: "center",
  },
  brand: {
    ...fieldTheme.text("h1"),
    color: fieldTheme.colors.primaryDeep,
    marginBottom: fieldTheme.spacing.xs,
  },
  tagline: {
    ...fieldTheme.text("body"),
    color: fieldTheme.colors.inkMuted,
    marginBottom: fieldTheme.spacing.xl,
  },
  input: {
    height: fieldTheme.minTarget,
    backgroundColor: fieldTheme.colors.surface,
    borderColor: fieldTheme.colors.line,
    borderWidth: 1,
    borderRadius: fieldTheme.radii.sm,
    paddingHorizontal: fieldTheme.spacing.md,
    color: fieldTheme.colors.ink,
    marginBottom: fieldTheme.spacing.md,
  },
  button: {
    height: fieldTheme.minTarget,
    backgroundColor: fieldTheme.colors.primary,
    borderRadius: fieldTheme.radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    ...fieldTheme.text("body"),
    color: fieldTheme.colors.onPrimary,
    fontWeight: "600",
  },
});
