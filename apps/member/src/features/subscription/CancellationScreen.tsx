import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { CancellationQuote, Subscription } from "@autocare/contracts";
import { etfSummaryText, requiresEtfAcceptance } from "./billingPreview";

export function CancellationScreen({ fetchQuote, onCancel, onDone }: {
  fetchQuote: () => Promise<CancellationQuote>;
  onCancel: (acceptEtf: boolean) => Promise<Subscription>;
  onDone: () => void;
}) {
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptEtf, setAcceptEtf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetchQuote().then(setQuote).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load cancellation details"));
  }, [fetchQuote]);

  const needsAcceptance = quote ? requiresEtfAcceptance(quote.etfCentavos) : false;
  const canConfirm = !!quote && (!needsAcceptance || acceptEtf);

  const confirmCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onCancel(needsAcceptance ? acceptEtf : false);
      setCancelled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel your subscription. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (cancelled) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Subscription cancelled</Text>
        <Button block style={{ marginTop: theme.spacing.lg }} testID="cancel-done" onPress={onDone}>
        Done
      </Button>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Cancel subscription</Text>

      {error ? (
        <Text testID="cancel-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>{error}</Text>
      ) : null}

      {quote ? (
        <>
          <Text testID="etf-summary" style={[theme.text("body"), { color: theme.colors.ink, marginTop: theme.spacing.md }]}>
            {etfSummaryText(quote.etfCentavos, quote.lockInEndsAt)}
          </Text>

          {needsAcceptance && (
            <Pressable testID="accept-etf" onPress={() => setAcceptEtf((a) => !a)}
              style={{ flexDirection: "row", alignItems: "center", marginTop: theme.spacing.lg }}>
              <View style={{ width: 24, height: 24, borderRadius: theme.radii.sm, borderWidth: 2,
                borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center",
                backgroundColor: acceptEtf ? theme.colors.primary : "transparent" }}>
                {acceptEtf ? <Text style={{ color: theme.colors.onPrimary }}>{"✓"}</Text> : null}
              </View>
              <Text style={[theme.text("body"), { color: theme.colors.ink, marginLeft: theme.spacing.sm, flex: 1 }]}>
                I understand and accept the early termination fee.
              </Text>
            </Pressable>
          )}

          <Button block style={{ marginTop: theme.spacing.lg }} testID="confirm-cancel" disabled={!canConfirm || submitting} onPress={confirmCancel}>
        {submitting ? "Cancelling…" : "Confirm cancellation"}
      </Button>
        </>
      ) : !error ? (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.md }]}>Loading…</Text>
      ) : null}
    </ScrollView>
  );
}
