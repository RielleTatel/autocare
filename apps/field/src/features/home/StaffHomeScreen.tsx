import { StyleSheet, Text, View } from "react-native";
import { fieldTheme } from "../../theme";

export interface StaffHomeScreenProps {
  name: string | null;
  role: string;
}

/** Placeholder post-login home — Phase 3/4 build the real work-order screens. */
export function StaffHomeScreen({ name, role }: StaffHomeScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.heading} testID="staff-home-heading">
        Signed in as {name ?? "Staff"} — {role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: fieldTheme.colors.chassis,
    alignItems: "center",
    justifyContent: "center",
    padding: fieldTheme.spacing.lg,
  },
  heading: {
    ...fieldTheme.text("h1"),
    color: fieldTheme.colors.primaryDeep,
    textAlign: "center",
  },
});
