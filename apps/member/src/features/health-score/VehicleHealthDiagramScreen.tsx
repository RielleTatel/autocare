import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { VehicleHealthViewer } from "./VehicleHealthViewer";
import type { InspectionDetail } from "./healthScoreApi";

export function VehicleHealthDiagramScreen({ detail, error, active = true, onBack, onRetry, onOpenBreakdown }: {
  detail: InspectionDetail | null;
  error?: string | null;
  active?: boolean;
  onBack: () => void;
  onRetry: () => void;
  onOpenBreakdown?: () => void;
}) {
  const t = theme;
  return <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.colors.surface }}>
    <View style={{ paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.lineSoft }}>
      <Button variant="ghost" icon="chevron-left" onPress={onBack} accessibilityLabel="Back to health score" style={{ paddingHorizontal: 0 }}>Health score</Button>
      <Text accessibilityRole="header" style={{ ...t.text("h1"), color: t.colors.ink }}>Vehicle diagram</Text>
    </View>
    {error ? <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
      <Text accessibilityRole="alert" style={{ ...t.text("body"), color: t.colors.inkMuted }}>{error}</Text>
      <Button onPress={onRetry}>Retry findings</Button>
    </View> : !detail ? <Skeleton.Screen cards={1} /> : detail.results.length === 0 ? <View style={{ padding: t.spacing.lg }}>
      <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No findings were recorded for this inspection.</Text>
    </View> : <ScrollView contentContainerStyle={{ padding: t.spacing.md, paddingBottom: t.spacing.lg }}>
      <VehicleHealthViewer key={`${detail.vehicleId ?? "vehicle"}:${detail.id}`} results={detail.results} enabled={active} onShapePress={() => undefined} onOpenBreakdown={onOpenBreakdown} />
    </ScrollView>}
  </SafeAreaView>;
}
