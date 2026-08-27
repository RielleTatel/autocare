import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Plan } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";
import { upgradePreviewText, downgradePreviewText } from "./billingPreview";
import { DowngradeResult, UpgradeResult } from "./subscriptionApi";

type Direction = "UPGRADE" | "DOWNGRADE";
type Selection = { plan: Plan; direction: Direction };
type Result = { direction: Direction; text: string };

/** Only the fields this screen reads — lets callers pass either a full `Plan` (from GET
 * /plans) or the plan summary embedded in a subscription (from GET /subscriptions/:id),
 * which lacks `entitlements`/`isActive`/`version`. */
export interface PlanSummary {
  id: string;
  name: string;
  priceCentavos: number;
  billingInterval: string;
  lockInMonths: number;
}

export function UpgradeDowngradeScreen({ currentPlan, fetchPlans, onUpgrade, onDowngrade, onDone }: {
  currentPlan: PlanSummary;
  fetchPlans: () => Promise<Plan[]>;
  onUpgrade: (planId: string) => Promise<UpgradeResult>;
  onDowngrade: (planId: string) => Promise<DowngradeResult>;
  onDone: () => void;
}) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetchPlans().then(setPlans).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load plans"));
  }, [fetchPlans]);

  const confirm = async () => {
    if (!selection) return;
    setSubmitting(true);
    setError(null);
    try {
      if (selection.direction === "UPGRADE") {
        const r = await onUpgrade(selection.plan.id);
        setResult({ direction: "UPGRADE", text: upgradePreviewText(r.proratedChargeCentavos) });
      } else {
        const r = await onDowngrade(selection.plan.id);
        setResult({ direction: "DOWNGRADE", text: downgradePreviewText(r.effectiveAt) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change your plan. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>
          {result.direction === "UPGRADE" ? "Plan upgraded" : "Downgrade scheduled"}
        </Text>
        <Text testID="change-result" style={[theme.text("body"), { color: theme.colors.ink, marginTop: theme.spacing.md }]}>
          {result.text}
        </Text>
        <Button block style={{ marginTop: theme.spacing.lg }} testID="change-done" onPress={onDone}>
        Done
      </Button>
      </View>
    );
  }

  const others = (plans ?? []).filter((p) => p.id !== currentPlan.id);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Change your plan</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
        Currently on {currentPlan.name} — {formatCentavos(currentPlan.priceCentavos)}
      </Text>

      {others.map((p) => {
        const direction: Direction = p.priceCentavos > currentPlan.priceCentavos ? "UPGRADE" : "DOWNGRADE";
        const selected = selection?.plan.id === p.id;
        return (
          <Pressable key={p.id} testID={`change-plan-${p.id}`} onPress={() => setSelection({ plan: p, direction })}
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
              marginTop: theme.spacing.md, borderWidth: 2, borderColor: selected ? theme.colors.primary : theme.colors.line }}>
            <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{p.name}</Text>
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>{formatCentavos(p.priceCentavos)}</Text>
            <Text style={[theme.text("label"), { color: theme.colors.primary, marginTop: theme.spacing.xs }]}>
              {direction === "UPGRADE" ? "Upgrade — applies now, pro-rated charge" : "Downgrade — applies next billing cycle"}
            </Text>
          </Pressable>
        );
      })}

      {error ? (
        <Text testID="change-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>{error}</Text>
      ) : null}

      {selection && (
        <Button block style={{ marginTop: theme.spacing.lg }} testID="confirm-change" disabled={submitting} onPress={confirm}>
        {submitting ? "Applying…" : `Confirm ${selection.direction === "UPGRADE" ? "upgrade" : "downgrade"}`}
      </Button>
      )}
    </ScrollView>
  );
}
