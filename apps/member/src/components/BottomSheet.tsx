import type { ReactNode } from "react";
import { Modal, Pressable, Text, View, type ViewStyle } from "react-native";
import { theme } from "../theme";

/**
 * Bottom-anchored progressive disclosure. Grabber, title, content, then one
 * dismissing action — the design system's `shell/BottomSheet.jsx`.
 *
 * The scrim is itself the dismiss target, with the panel swallowing presses so
 * a tap inside never closes it.
 */
export function BottomSheet({
  open = true, title, children, onClose, closeLabel = "Got it", style, testID,
}: {
  open?: boolean;
  title?: string;
  children?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const t = theme;
  if (!open) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        // Distinct from the sheet's own close button, which carries `closeLabel`
        // — two controls sharing one label is ambiguous to a screen reader.
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: t.elevation.scrim, justifyContent: "flex-end" }}
      >
        <Pressable
          testID={testID}
          onPress={() => undefined}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.md,
            borderTopRightRadius: t.radii.md,
            padding: t.spacing.lg,
            gap: t.spacing.sm,
            ...style,
          }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.line, alignSelf: "center" }}
          />
          {title ? <Text style={{ ...t.text("h1"), color: t.colors.ink }}>{title}</Text> : null}
          {children}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={{
              minHeight: t.minTarget,
              borderRadius: t.radii.md,
              backgroundColor: t.colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginTop: t.spacing.xs,
            }}
          >
            <Text style={{ ...t.text("h2"), color: t.colors.onPrimary }}>{closeLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The measured-value readout used inside explain sheets. */
export function MeasuredRow({ children, testID }: { children: ReactNode; testID?: string }) {
  const t = theme;
  return (
    <View testID={testID} style={{ backgroundColor: t.colors.chassis, borderRadius: t.radii.sm, padding: t.spacing.sm }}>
      <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{children}</Text>
    </View>
  );
}
