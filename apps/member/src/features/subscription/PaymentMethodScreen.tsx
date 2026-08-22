import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Plan, Subscription } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";

type Method = "COD" | "E_PAYMENT";

export function PaymentMethodScreen({ plan, createSubscription, createPaymentIntent, openCheckout, refreshSubscriptionStatus, onDone }: {
  plan: Plan;
  /** POST /subscriptions for the chosen method — the Idempotency-Key header is added inside subscriptionApi. */
  createSubscription: (method: Method) => Promise<Subscription>;
  /** POST /payments/intents for the subscription's freshly-issued invoice. */
  createPaymentIntent: (subscription: Subscription) => Promise<{ checkoutUrl: string }>;
  /** Opens the PayMongo checkout URL and resolves once the user returns via the autocare://payment-result deep link. */
  openCheckout: (url: string) => Promise<{ type: string; url?: string }>;
  refreshSubscriptionStatus: (subscriptionId: string) => Promise<Subscription>;
  onDone: (subscription: Subscription) => void;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codResult, setCodResult] = useState<Subscription | null>(null);

  const handleCod = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sub = await createSubscription("COD");
      setCodResult(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start your subscription. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEPayment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sub = await createSubscription("E_PAYMENT");
      const intent = await createPaymentIntent(sub);
      const result = await openCheckout(intent.checkoutUrl);
      if (result.type === "success") {
        const updated = await refreshSubscriptionStatus(sub.id);
        onDone(updated);
      } else {
        setError("Payment wasn't completed. You can retry from your subscription dashboard.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (codResult) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Invoice issued</Text>
        <Text testID="cod-confirmation" style={[theme.text("body"), { color: theme.colors.ink, marginTop: theme.spacing.md }]}>
          Your {plan.name} subscription is set up for Cash on Delivery. Pay {formatCentavos(plan.priceCentavos)} at the counter
          when our team arrives — you'll get a receipt on the spot.
        </Text>
        <Pressable testID="cod-continue" onPress={() => onDone(codResult)}
          style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
            backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>How would you like to pay?</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
        {plan.name} — {formatCentavos(plan.priceCentavos)}
      </Text>

      <Pressable testID="method-epayment" onPress={() => setMethod("E_PAYMENT")}
        style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
          marginTop: theme.spacing.lg, borderWidth: 2, borderColor: method === "E_PAYMENT" ? theme.colors.primary : theme.colors.line }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Pay online now</Text>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
          Card, e-wallet, or bank transfer via a secure checkout page. Instant activation.
        </Text>
      </Pressable>

      <Pressable testID="method-cod" onPress={() => setMethod("COD")}
        style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
          marginTop: theme.spacing.sm, borderWidth: 2, borderColor: method === "COD" ? theme.colors.primary : theme.colors.line }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Cash on Delivery</Text>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
          We'll issue your invoice now — pay in cash at the counter when our team arrives.
        </Text>
      </Pressable>

      {error ? (
        <Text testID="payment-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>
          {error}
        </Text>
      ) : null}

      {method === "E_PAYMENT" && (
        <Pressable testID="confirm-epayment" disabled={submitting} onPress={handleEPayment}
          style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
            backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>
            {submitting ? "Opening checkout…" : "Continue to payment"}
          </Text>
        </Pressable>
      )}
      {method === "COD" && (
        <Pressable testID="confirm-cod" disabled={submitting} onPress={handleCod}
          style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
            backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>
            {submitting ? "Setting up…" : "Confirm Cash on Delivery"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
