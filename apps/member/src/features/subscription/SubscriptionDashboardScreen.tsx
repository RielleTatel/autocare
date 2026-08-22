import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { EntitlementSummary } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";
import { entitlementFraction, entitlementLabel, lockInDaysRemaining, statusMessage, SubscriptionStatus } from "./entitlements";
import { SubscriptionWithPlan } from "./subscriptionApi";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  ACTIVE: theme.colors.primary, GRACE: theme.colors.danger, PAST_DUE: theme.colors.danger,
  SUSPENDED: theme.colors.danger, CANCELLED: theme.colors.inkMuted,
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

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Loading your subscription…</Text>
      </View>
    );
  }

  const { subscription, entitlements } = data;
  const status = subscription.status as SubscriptionStatus;
  const daysLeft = lockInDaysRemaining(subscription.lockInEndsAt);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>{subscription.plan.name}</Text>

      <View testID="status-banner" style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md,
        padding: theme.spacing.md, marginTop: theme.spacing.sm, borderWidth: 1, borderColor: STATUS_COLOR[status] }}>
        <Text style={[theme.text("label"), { color: STATUS_COLOR[status] }]}>{status}</Text>
        <Text style={[theme.text("body"), { color: theme.colors.ink, marginTop: theme.spacing.xs }]}>{statusMessage(status)}</Text>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Next billing date</Text>
        <Text testID="next-billing" style={[theme.text("h2"), { color: theme.colors.ink }]}>{formatDate(subscription.currentPeriodEnd)}</Text>
      </View>

      {daysLeft > 0 ? (
        <Text testID="lockin-countdown" style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
          Locked in for {daysLeft} more day{daysLeft === 1 ? "" : "s"} (until {formatDate(subscription.lockInEndsAt)})
        </Text>
      ) : (
        <Text testID="lockin-countdown" style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
          No active lock-in — you can cancel any time
        </Text>
      )}

      <Text style={[theme.text("h2"), { color: theme.colors.ink, marginTop: theme.spacing.lg }]}>This cycle's entitlements</Text>
      {entitlements.map((e) => <EntitlementGauge key={e.entitlementType} e={e} />)}

      <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.md }]}>
        {formatCentavos(subscription.plan.priceCentavos)} / {subscription.plan.billingInterval.toLowerCase()}
      </Text>

      <Pressable testID="manage-plan" onPress={onManagePlan}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
          backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Upgrade or downgrade</Text>
      </Pressable>
      <Pressable testID="view-invoices" onPress={onViewInvoices}
        style={{ height: theme.minTarget, justifyContent: "center", alignItems: "center", marginTop: theme.spacing.sm }}>
        <Text style={[theme.text("body"), { color: theme.colors.primary }]}>View invoices</Text>
      </Pressable>
      <Pressable testID="cancel-subscription" onPress={onCancel}
        style={{ height: theme.minTarget, justifyContent: "center", alignItems: "center", marginTop: theme.spacing.xs }}>
        <Text style={[theme.text("body"), { color: theme.colors.danger }]}>Cancel subscription</Text>
      </Pressable>
    </ScrollView>
  );
}
