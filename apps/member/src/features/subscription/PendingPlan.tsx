import { Text } from "react-native";
import { Plan } from "@autocare/contracts";
import { theme } from "../../theme";
import { SubscriptionWithPlan } from "./subscriptionApi";

export function PendingPlan({ subscription, plans = [] }: { subscription: SubscriptionWithPlan; plans?: Plan[] }) {
  if (!subscription.pendingPlanId) return null;
  const pending = subscription.pendingPlan ?? plans.find(plan => plan.id === subscription.pendingPlanId);
  const date = new Date(subscription.currentPeriodEnd).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
  return <Text testID="pending-plan" style={[theme.text("body"), { color: theme.colors.ink }]}>
    {pending?.name ?? "Your selected plan"} is scheduled for {date}. No charge today. {subscription.plan.name} remains your current plan until then.
  </Text>;
}
