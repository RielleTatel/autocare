import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { theme } from "../../theme";
import { Plan } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";
import { PlanCard } from "../../components/PlanCard";

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
        <PlanCard
          key={plan.id}
          testID={`plan-${plan.id}`}
          name={plan.name}
          price={formatCentavos(plan.priceCentavos)}
          interval={plan.billingInterval as "MONTHLY" | "QUARTERLY" | "ANNUAL"}
          lockInMonths={plan.lockInMonths}
          inclusions={plan.entitlements.map(
            (e) => `${e.quantityPerCycle} ${e.entitlementType.toLowerCase().replace(/_/g, " ")}/cycle`,
          )}
          onSelect={() => onSelectPlan(plan)}
          style={{ marginBottom: theme.spacing.sm }}
        />
      ))}
    </ScrollView>
  );
}
