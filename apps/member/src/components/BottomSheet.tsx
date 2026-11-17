import { useContext, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { theme } from "../theme";

/**
 * Bottom-anchored progressive disclosure. Grabber, title, content, then one
 * dismissing action — the design system's `shell/BottomSheet.jsx`.
 *
 * The scrim is itself the dismiss target, with the panel swallowing presses so
 * a tap inside never closes it.
 */
export function BottomSheet({
  open = true, title, children, onClose, closeLabel = "Got it", style, testID, contentKey,
}: {
  open?: boolean;
  title?: string;
  children?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  style?: ViewStyle;
  testID?: string;
  /** Reset scroll position when navigating within the same native sheet. */
  contentKey?: string;
}) {
  const t = theme;
  const { height } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  if (!open) return null;

  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "flex-end", paddingTop: top + t.spacing.md }}>
        <Pressable
          accessibilityRole="button"
          // Distinct from the sheet's own close button, which carries `closeLabel`
          // — two controls sharing one label is ambiguous to a screen reader.
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={{ position: "absolute", inset: 0, backgroundColor: t.elevation.scrim }}
        />
        <Pressable
          testID={testID}
          accessible={false}
          onPress={() => undefined}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.md,
            borderTopRightRadius: t.radii.md,
            padding: t.spacing.lg,
            paddingBottom: Math.max(bottom, t.spacing.md),
            gap: t.spacing.sm,
            ...style,
            maxHeight: height - top - t.spacing.md,
            flexShrink: 1,
          }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.line, alignSelf: "center" }}
          />
          {title ? <Text accessibilityRole="header" style={{ ...t.text("h1"), color: t.colors.ink, flexShrink: 0 }}>{title}</Text> : null}
          <ScrollView key={contentKey} style={{ flexShrink: 1, flexGrow: 0 }} contentContainerStyle={{ gap: t.spacing.sm, paddingBottom: t.spacing.sm }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={{
              minHeight: t.minTarget,
              flexShrink: 0,
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
      </View>
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
