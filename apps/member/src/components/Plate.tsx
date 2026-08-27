import { Text, View, type TextStyle } from "react-native";
import { theme } from "../theme";

type Variant = "chip" | "plain" | "outline";

/**
 * Machine identity — plate numbers, VINs, verification codes. Always the mono
 * face, always letter-spaced, never used for prose. Ported from the design
 * system's `components/core/Plate.jsx`.
 *
 * `chip` is the navy chip that sits on vehicle cards; `plain` is the bare mono
 * run used inside list rows; `outline` is the boxed, plate-like treatment.
 */
export function Plate({
  children, variant = "outline", style, testID,
}: {
  children: string;
  variant?: Variant;
  style?: TextStyle;
  testID?: string;
}) {
  const t = theme;

  if (variant === "plain") {
    return (
      <Text testID={testID} style={{ ...t.text("code"), color: t.colors.ink, letterSpacing: 1, ...style }}>
        {children}
      </Text>
    );
  }

  const chip = variant === "chip";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: t.radii.sm,
        paddingHorizontal: chip ? t.spacing.sm : 14,
        paddingVertical: 4,
        backgroundColor: chip ? t.colors.primaryDeep : t.colors.surface,
        ...(chip ? null : { borderWidth: 2, borderColor: t.colors.ink }),
      }}
    >
      <Text
        testID={testID}
        style={{
          ...t.text("code"),
          ...(chip ? null : { fontSize: 18 }),
          letterSpacing: chip ? 1 : 2,
          color: chip ? t.colors.onPrimary : t.colors.ink,
          ...style,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
