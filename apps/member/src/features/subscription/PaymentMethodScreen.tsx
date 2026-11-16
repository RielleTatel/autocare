import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Plan, Subscription } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";
import { SubscriptionCreation } from "./subscriptionApi";

type Method = "COD" | "E_PAYMENT";

export function PaymentMethodScreen({ plan, createSubscription, onCheckoutInvoice, onDone }: {
  plan: Plan;
  createSubscription: (method: Method) => Promise<SubscriptionCreation>;
  onCheckoutInvoice: (invoiceId: string, subscription: SubscriptionCreation) => void;
  onDone: (subscription: Subscription) => void;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SubscriptionCreation | null>(null);
  const busy = useRef(false);
  const saved = useRef<SubscriptionCreation | null>(null);
  const confirm = async () => {
    if (!method || busy.current) return;
    busy.current = true; setSubmitting(true); setError(null);
    try {
      const subscription = saved.current ?? await createSubscription(method);
      saved.current = subscription; setCreated(subscription);
      if (method === "E_PAYMENT") {
        if (!subscription.invoiceId) throw new Error("Your subscription was created. Open Invoices to recover its payment; do not create another subscription.");
        onCheckoutInvoice(subscription.invoiceId, subscription);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set up your subscription. Try again.");
    } finally { busy.current = false; setSubmitting(false); }
  };
  if (created?.paymentMethod === "COD") return <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md }}>
    <Text style={theme.text("h1")}>Invoice issued</Text>
    <Text testID="cod-confirmation">Your {plan.name} subscription is set up for Cash on Delivery. Pay {formatCentavos(plan.priceCentavos)} at the counter.</Text>
    <Button testID="cod-continue" onPress={() => onDone(created)}>Continue</Button>
  </View>;
  return <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
    <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>How would you like to pay?</Text>
    <Text style={theme.text("body")}>{plan.name} · {formatCentavos(plan.priceCentavos)}</Text>
    <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Online checkout is a sandbox test. Use official test cards only; no real money moves.</Text>
    {([['E_PAYMENT', 'Test card checkout', 'Review your invoice, then open PayMongo sandbox checkout.'], ['COD', 'Cash on Delivery', 'An invoice is issued now; pay at the counter.']] as const).map(([value, title, detail]) =>
      <Pressable key={value} testID={value === "COD" ? "method-cod" : "method-epayment"} disabled={submitting || !!created}
        onPress={() => setMethod(value)} style={{ minHeight: theme.minTarget, backgroundColor: theme.colors.surface, padding: theme.spacing.md,
          borderRadius: theme.radii.md, borderWidth: 2, borderColor: method === value ? theme.colors.primary : theme.colors.line }}>
        <Text style={theme.text("h2")}>{title}</Text><Text style={theme.text("body")}>{detail}</Text>
      </Pressable>)}
    {error ? <Text testID="payment-error" style={{ color: theme.colors.danger }}>{error}</Text> : null}
    {method ? <Button testID={method === "COD" ? "confirm-cod" : "confirm-epayment"} disabled={submitting} onPress={() => void confirm()}>
      {submitting ? "Setting up…" : method === "COD" ? "Confirm Cash on Delivery" : "Continue to invoice"}
    </Button> : null}
    {created ? <Button variant="secondary" testID="subscription-recovery" onPress={() => onDone(created)}>View subscription and invoices</Button> : null}
  </ScrollView>;
}
