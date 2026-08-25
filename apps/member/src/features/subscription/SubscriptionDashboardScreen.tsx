import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { EntitlementSummary } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";
import { entitlementFraction, entitlementLabel, lockInDaysRemaining, statusMessage, SubscriptionStatus } from "./entitlements";
import { SubscriptionWithPlan } from "./subscriptionApi";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { StatusPill } from "../../components/StatusPill";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";
const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  ACTIVE: "success", GRACE: "warn", PAST_DUE: "danger", SUSPENDED: "danger", CANCELLED: "neutral",
};

function EntitlementGauge({ e }: { e: EntitlementSummary }) {
  const fraction = entitlementFraction(e);
  return (
    <View testID={`gauge-${e.entitlementType}`} style={{ marginTop: theme.spacing.sm }}>
      <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{entitlementLabel(e)}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.line, marginTop: theme.spacing.xs, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.colors.primary }} />
      </View>
    </View>
  );
}

export function SubscriptionDashboardScreen({ fetchDashboard, onManagePlan, onCancel, onViewInvoices }: {
  fetchDashboard: () => Promise<{ subscription: SubscriptionWithPlan; entitlements: EntitlementSummary[] }>;
  onManagePlan: () => void;
  onCancel: () => void;
  onViewInvoices: () => void;
}) {
  const [data, setData] = useState<{ subscription: SubscriptionWithPlan; entitlements: EntitlementSummary[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const d = await fetchDashboard();
    setData(d);
  }, [fetchDashboard]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const t = theme;

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center" }}>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Loading your subscription…</Text>
      </View>
    );
  }

  const { subscription, entitlements } = data;
  const status = subscription.status as SubscriptionStatus;
  const daysLeft = lockInDaysRemaining(subscription.lockInEndsAt);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>Account</Text>

      {/* Plan + status card */}
      <Card testID="status-banner" pad="lg" style={{ gap: t.spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>{subscription.plan.name}</Text>
          <StatusPill tone={STATUS_TONE[status]}>{status}</StatusPill>
        </View>
        <Text style={[t.text("label"), { color: t.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: t.spacing.xs }]}>
          Next billing date
        </Text>
        <Text testID="next-billing" style={[t.text("body"), { color: t.colors.ink }]}>
          {formatDate(subscription.currentPeriodEnd)} · {formatCentavos(subscription.plan.priceCentavos)}
        </Text>
        <Text testID="lockin-countdown" style={[t.text("label"), { color: t.colors.inkMuted }]}>
          {daysLeft > 0
            ? `Locked in for ${daysLeft} more day${daysLeft === 1 ? "" : "s"} · ends ${formatDate(subscription.lockInEndsAt)}`
            : "No active lock-in — you can cancel any time"}
        </Text>
        <Text style={[t.text("label"), { color: t.colors.inkMuted, marginTop: t.spacing.xs }]}>{statusMessage(status)}</Text>
      </Card>

      {/* This cycle's entitlements */}
      <Card pad="lg">
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>This cycle's entitlements</Text>
        {entitlements.map((e) => <EntitlementGauge key={e.entitlementType} e={e} />)}
      </Card>

      <Button block testID="manage-plan" onPress={onManagePlan}>Upgrade or downgrade</Button>
      <Pressable testID="view-invoices" onPress={onViewInvoices} style={{ height: t.minTarget, justifyContent: "center", alignItems: "center" }}>
        <Text style={[t.text("body"), { color: t.colors.primary }]}>View invoices</Text>
      </Pressable>
      <Pressable testID="cancel-subscription" onPress={onCancel} style={{ height: t.minTarget, justifyContent: "center", alignItems: "center" }}>
        <Text style={[t.text("body"), { color: t.colors.danger }]}>Cancel subscription</Text>
      </Pressable>
    </ScrollView>
  );
}
