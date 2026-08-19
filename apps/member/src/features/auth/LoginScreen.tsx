import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";

export function LoginScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>AutoCare+</Text>
      <Text style={styles.tagline}>Membership car care, on schedule.</Text>

      <TextInput
        style={styles.input}
        placeholder="Mobile number"
        placeholderTextColor={theme.colors.inkMuted}
        keyboardType="phone-pad"
        autoComplete="tel"
      />

      <Pressable style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonLabel}>Continue</Text>
      </Pressable>

      <Text style={styles.footnote}>By continuing you agree to our Terms and Privacy Policy.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.chassis,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },
  brand: {
    ...theme.text("h1"),
    color: theme.colors.primaryDeep,
    marginBottom: theme.spacing.xs,
  },
  tagline: {
    ...theme.text("body"),
    color: theme.colors.inkMuted,
    marginBottom: theme.spacing.xl,
  },
  input: {
    height: theme.minTarget,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.ink,
    marginBottom: theme.spacing.md,
  },
  button: {
    height: theme.minTarget,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    ...theme.text("body"),
    color: theme.colors.onPrimary,
    fontWeight: "600",
  },
  footnote: {
    ...theme.text("label"),
    color: theme.colors.inkMuted,
    marginTop: theme.spacing.lg,
    textAlign: "center",
  },
});
