import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import type { EntitlementSummary, Plan } from "@autocare/contracts";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { StatusPill } from "../../components/StatusPill";
import { PlanCard } from "../../components/PlanCard";
import { Icon } from "../../components/Icon";
import { formatCentavos } from "../subscription/formatCentavos";
import {
  entitlementFraction, entitlementLabel, lockInDaysRemaining, statusMessage, type SubscriptionStatus,
} from "../subscription/entitlements";
import type { SubscriptionWithPlan } from "../subscription/subscriptionApi";

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";
const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  ACTIVE: "success", GRACE: "warn", PAST_DUE: "danger", SUSPENDED: "danger", CANCELLED: "neutral",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

/** Plan inclusions, spelled out — the member has to see everything they gain or lose. */
function inclusionsOf(plan: Plan): string[] {
  return plan.entitlements.map(
    (e) => `${e.quantityPerCycle} ${e.entitlementType.toLowerCase().replace(/_/g, " ")}/cycle`,
  );
}

function EntitlementGauge({ e }: { e: EntitlementSummary }) {
  const t = theme;
  return (
    <View testID={`gauge-${e.entitlementType}`} style={{ marginTop: t.spacing.sm }}>
      <Text style={[t.text("body"), { color: t.colors.ink }]}>{entitlementLabel(e)}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.line, marginTop: t.spacing.xs, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${Math.round(entitlementFraction(e) * 100)}%`, backgroundColor: t.colors.primary }} />
      </View>
    </View>
  );
}

/** A titled set of settings rows. The heading names what the group is for, so
 *  four rows read as three concerns instead of one list. */
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const t = theme;
  return (
    <View style={{ gap: t.spacing.xs }}>
      <Text style={[t.text("label", 600), { color: t.colors.inkMuted, letterSpacing: 0.5 }]}>
        {title.toUpperCase()}
      </Text>
      <Card pad="none" style={{ paddingHorizontal: t.spacing.md }}>{children}</Card>
    </View>
  );
}

function Row({
  label, onPress, testID, badge, badgeTestID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  /** Unread count. Rendered only when > 0 — a zero badge is worse than none. */
  badge?: number;
  badgeTestID?: string;
}) {
  const t = theme;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: t.minTarget,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.line,
        },
        pressed ? { opacity: t.motion.pressOpacity } : null,
      ]}
    >
      <Text style={[t.text("body"), { color: t.colors.ink }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
        {badge ? (
          <View
            testID={badgeTestID}
            style={{
              minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10,
              backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={[t.text("label"), { color: t.colors.onPrimary }]}>{badge}</Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={18} color={t.colors.inkMuted} />
      </View>
    </Pressable>
  );
}

/**
 * M-28/M-29 — the Account tab, composed to the design system's member kit:
 * identity, the plan + status card, inline plan switching, then the settings
 * rows. The profile edit form lives behind "Personal details" rather than
 * being the whole tab.
 */
export function AccountScreen({
  name, email, subscription, entitlements, plans, refreshing, onRefresh,
  onChangePlan, onPersonalDetails, onSubscriptionDetails, onInvoices, onPrivacy, onSignOut,
  onAnnouncements, unreadAnnouncements = 0,
}: {
  name: string;
  email?: string;
  subscription: SubscriptionWithPlan | null;
  entitlements: EntitlementSummary[];
  /** All sellable plans; the current one renders as selected and non-actionable. */
  plans: Plan[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onChangePlan: (plan: Plan) => void;
  onPersonalDetails: () => void;
  onAnnouncements: () => void;
  /** Unread announcement count for the row badge. */
  unreadAnnouncements?: number;
  onSubscriptionDetails: () => void;
  onInvoices: () => void;
  onPrivacy: () => void;
  onSignOut: () => void;
}) {
  const t = theme;
  const status = subscription?.status as SubscriptionStatus | undefined;
  const daysLeft = subscription ? lockInDaysRemaining(subscription.lockInEndsAt) : 0;
  const currentPlanId = subscription?.plan.id;

  return (
    <ScrollView
      testID="account-screen"
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.md, gap: t.spacing.md }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>Account</Text>
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
          {[name, email].filter(Boolean).join(" · ")}
        </Text>
      </View>

      {subscription && status ? (
        <Card testID="status-banner" style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>{subscription.plan.name}</Text>
            <StatusPill tone={STATUS_TONE[status]}>{status}</StatusPill>
          </View>
          <Text style={[t.text("label"), { color: t.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 }]}>
            Next billing date
          </Text>
          <Text testID="next-billing" style={[t.text("body"), { color: t.colors.ink }]}>
            {formatDate(subscription.currentPeriodEnd)} · {formatCentavos(subscription.plan.priceCentavos)}
          </Text>
          <Text testID="lockin-countdown" style={[t.text("label"), { color: t.colors.inkMuted }]}>
            {daysLeft > 0
              ? `${subscription.plan.lockInMonths}-month lock-in · ends ${formatDate(subscription.lockInEndsAt)}`
              : "No active lock-in — you can cancel any time"}
          </Text>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{statusMessage(status)}</Text>
        </Card>
      ) : (
        <Card testID="no-subscription">
          <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
            No active subscription on this account.
          </Text>
        </Card>
      )}

      {entitlements.length > 0 ? (
        <Card>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>This cycle&apos;s entitlements</Text>
          {entitlements.map((e) => <EntitlementGauge key={e.entitlementType} e={e} />)}
        </Card>
      ) : null}

      {plans.length > 0 ? (
        <View style={{ gap: t.spacing.sm }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>Change plan</Text>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const cheaper = subscription ? plan.priceCentavos < subscription.plan.priceCentavos : false;
            return (
              <PlanCard
                key={plan.id}
                testID={`plan-${plan.id}`}
                name={plan.name}
                price={formatCentavos(plan.priceCentavos)}
                interval={plan.billingInterval as "MONTHLY" | "QUARTERLY" | "ANNUAL"}
                lockInMonths={plan.lockInMonths}
                inclusions={inclusionsOf(plan)}
                selected={isCurrent}
                disabled={isCurrent}
                actionLabel={isCurrent ? "Current plan" : cheaper ? "Downgrade" : "Upgrade"}
                onSelect={() => onChangePlan(plan)}
              />
            );
          })}
        </View>
      ) : null}

      {/* Grouped so the tail of the screen reads as a few decisions rather than
          one undifferentiated stack. Only rows that already have a route
          appear — a settings list that navigates nowhere reads as broken. */}
      <SettingsGroup title="Account">
        <Row
          testID="row-announcements"
          badgeTestID="announcements-badge"
          label="Announcements"
          badge={unreadAnnouncements}
          onPress={onAnnouncements}
        />
        <Row testID="row-personal" label="Personal details" onPress={onPersonalDetails} />
        <Row testID="row-subscription" label="Subscription details" onPress={onSubscriptionDetails} />
      </SettingsGroup>

      <SettingsGroup title="Billing">
        <Row testID="row-invoices" label="Invoices & receipts" onPress={onInvoices} />
      </SettingsGroup>

      <SettingsGroup title="Legal & data">
        <Row testID="row-privacy" label="Privacy & data" onPress={onPrivacy} />
      </SettingsGroup>

      <Card>
        <Pressable
          testID="sign-out"
          accessibilityRole="button"
          onPress={onSignOut}
          style={{ minHeight: t.minTarget, justifyContent: "center" }}
        >
          <Text style={[t.text("body", 600), { color: t.colors.danger }]}>Sign out</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
