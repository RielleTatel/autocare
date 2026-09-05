import { View } from "react-native";
import { theme } from "../theme";
import { Card } from "./Card";

/**
 * Loading placeholders shaped like the content that is coming, so a screen
 * resolves into itself instead of flashing from blank to full.
 *
 * Deliberately still: a shimmer would be decoration on a state the user should
 * be leaving, and the brief rules out animation that does not communicate.
 */
function Line({ width = "100%", height = 14 }: { width?: number | string; height?: number }) {
  return (
    <View
      testID="skeleton-line"
      style={{
        width: width as never,
        height,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.line,
      }}
    />
  );
}

/** A card-shaped block: a heading line, then body lines of tapering width. */
function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const widths = ["70%", "100%", "45%", "85%", "60%"];
  return (
    <Card testID="skeleton-card" style={{ gap: theme.spacing.sm }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Line key={i} width={widths[i % widths.length]} height={i === 0 ? 18 : 14} />
      ))}
    </Card>
  );
}

/**
 * A whole screen mid-load: a heading, then cards. Matches the padding and
 * rhythm the real screens use, so content lands where its placeholder was
 * instead of the layout jumping when data arrives.
 *
 * Not for app boot — before auth resolves there is no known layout to preview,
 * which is the one case a branded splash is doing real work.
 */
function Screen({ cards = 3 }: { cards?: number }) {
  return (
    <View
      testID="skeleton-screen"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{
        flex: 1,
        backgroundColor: theme.colors.chassis,
        padding: theme.spacing.lg,
        gap: theme.spacing.lg,
      }}
    >
      <Line width="55%" height={24} />
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} lines={i === 0 ? 3 : 2} />
      ))}
    </View>
  );
}

export const Skeleton = { Line, Card: SkeletonCard, Screen };
