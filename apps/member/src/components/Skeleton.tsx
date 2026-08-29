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

export const Skeleton = { Line, Card: SkeletonCard };
