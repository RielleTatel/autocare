import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Plan } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";

const INTERVAL_LABEL: Record<string, string> = { MONTHLY: "/month", QUARTERLY: "/quarter", ANNUAL: "/year" };

function lockInText(months: number) {
  return months > 0 ? `${months}-month lock-in` : "No lock-in";
}

function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: () => void }) {
  return (
    <Pressable testID={`plan-${plan.id}`} onPress={onSelect}
      style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
        marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{plan.name}</Text>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep, marginTop: theme.spacing.xs }]}>
        {formatCentavos(plan.priceCentavos)}
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{INTERVAL_LABEL[plan.billingInterval] ?? ""}</Text>
      </Text>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
        {lockInText(plan.lockInMonths)}
      </Text>
      <View style={{ marginTop: theme.spacing.sm }}>
        {plan.entitlements.map((e) => (
          <Text key={e.id} style={[theme.text("body"), { color: theme.colors.ink }]}>
            {"• "}{e.quantityPerCycle} {e.entitlementType.toLowerCase().replace(/_/g, " ")}/cycle
          </Text>
        ))}
      </View>
      <View style={{ height: theme.minTarget, marginTop: theme.spacing.sm, borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body", 600), { color: theme.colors.onPrimary }]}>Choose this plan</Text>
      </View>
    </Pressable>
  );
}

export function PlanSelectionScreen({ fetchPlans, onSelectPlan }: {
  fetchPlans: () => Promise<Plan[]>;
  onSelectPlan: (plan: Plan) => void;
}) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans().then(setPlans).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load plans"));
  }, [fetchPlans]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Choose a plan</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg }]}>
        Compare inclusions and pick what fits your vehicle.
      </Text>
      {error ? (
        <Text testID="plans-error" style={[theme.text("label"), { color: theme.colors.danger }]}>{error}</Text>
      ) : null}
      {plans === null && !error ? (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Loading plans…</Text>
      ) : null}
      {(plans ?? []).map((plan) => (
        <PlanCard key={plan.id} plan={plan} onSelect={() => onSelectPlan(plan)} />
      ))}
    </ScrollView>
  );
}
