import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Invoice } from "@autocare/contracts";
import { Button } from "../../components/Button";
import { theme } from "../../theme";
import { InvoiceDetailScreen } from "./InvoiceDetailScreen";
import { newIdempotencyKey } from "./billingPreview";
import { HistoryPage, ServiceDocumentScreen } from "../service-history/ServiceHistoryScreens";

export type CheckoutInvoice = Invoice & { checkoutEligible?: boolean };
type PaymentState = "idle" | "opening" | "checking" | "pending" | "cancelled" | "failed";

/** Only an authenticated invoice read establishes payment; popup returns are hints to refresh. */
export function InvoicePaymentScreen({ invoiceId, fetchInvoice, createPaymentIntent, openCheckout, onDownloadReceipt, onBack, navigation, returnOutcome, pollDelayMs = 2000, pollAttempts = 5 }: {
  invoiceId: string;
  fetchInvoice: (id: string) => Promise<CheckoutInvoice>;
  createPaymentIntent: (id: string, operationKey: string) => Promise<{ checkoutUrl: string }>;
  openCheckout: (url: string) => Promise<{ type: string; url?: string }>;
  onDownloadReceipt: () => Promise<void>;
  onBack: () => void;
  navigation?: any;
  returnOutcome?: string;
  pollDelayMs?: number;
  pollAttempts?: number;
}) {
  const [invoice, setInvoice] = useState<CheckoutInvoice | null>(null);
  const [state, setState] = useState<PaymentState>(returnOutcome === "returned" ? "checking" : returnOutcome === "cancelled" ? "cancelled" : "idle");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const attempt = useRef<{ key: string; url?: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    try {
      const current = await fetchInvoice(invoiceId);
      if (alive.current) { setInvoice(current); setError(null); }
      return current;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Couldn't load invoice. Try again.");
      throw e;
    }
  }, [fetchInvoice, invoiceId]);
  const check = useCallback(async (poll = true) => {
    if (alive.current) setState("checking");
    for (let i = 0; i < (poll ? pollAttempts : 1); i++) {
      const current = await load();
      if (!alive.current) return;
      if (current.status === "PAID") { setState("idle"); return; }
      if (i + 1 < (poll ? pollAttempts : 1)) await new Promise(resolve => setTimeout(resolve, pollDelayMs));
    }
    if (alive.current) setState("pending");
  }, [load, pollAttempts, pollDelayMs]);

  useEffect(() => {
    const returned = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const current = await load();
        if (!alive.current || current.status === "PAID") return;
        if (returnOutcome === "returned") await check();
        else if (returnOutcome === "cancelled") setState("cancelled");
      } catch { if (alive.current) setState("failed"); }
      finally { busy.current = false; }
    };
    void returned();
    return navigation?.addListener?.("focus", () => { void load().catch(() => undefined); });
  }, [load, check, navigation, returnOutcome]);

  const pay = async () => {
    if (busy.current) return;
    busy.current = true; setState("opening"); setError(null);
    try {
      // Refresh eligibility so a stale Pay button cannot pay a settled/cancelled invoice.
      const current = await load();
      if (!alive.current) return;
      if (current.status === "PAID" || !current.checkoutEligible) { setState("idle"); return; }
      if (!attempt.current) attempt.current = { key: newIdempotencyKey() };
      const intent = await createPaymentIntent(invoiceId, attempt.current.key);
      if (!alive.current) return;
      attempt.current.url = intent.checkoutUrl;
      const result = await openCheckout(intent.checkoutUrl);
      // A resolved provider attempt may be retried as a new checkout; an uncertain HTTP
      // initiation error retains its operation key until the same request is recovered.
      attempt.current = null;
      if (!alive.current) return;
      const returned = await load();
      if (returned.status === "PAID") { setState("idle"); return; }
      const outcome = result.url ? new URL(result.url).searchParams.get("outcome") : null;
      if (result.type === "cancel" || result.type === "dismiss" || (outcome === "cancel" || outcome === "cancelled")) {
        setState("cancelled");
      } else await check();
    } catch (e) {
      if (alive.current) {
        setState("failed"); setError(e instanceof Error ? e.message : "Couldn't open checkout. Try again.");
      }
    } finally { busy.current = false; }
  };
  const checkAgain = async () => {
    if (busy.current) return;
    busy.current = true;
    try { await check(); } catch { if (alive.current) setState("failed"); }
    finally { busy.current = false; }
  };
  if (!invoice) return <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
    <Text>{error ?? "Loading invoice…"}</Text>
    {error ? <Button testID="invoice-retry" onPress={() => void load().catch(() => undefined)}>Try again</Button> : null}
    <Button variant="secondary" onPress={onBack}>Back</Button>
  </View>;
  if (invoice.subscriptionId === null) return <HistoryPage title="Final bill & receipt" onBack={onBack}
    loading={false} error={error} onRefresh={() => void load().catch(() => undefined)}>
    <ServiceDocumentScreen document={invoice} onOpenDocument={onDownloadReceipt} />
  </HistoryPage>;
  const pending = state === "pending" || state === "checking";
  const paymentContent = <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
    <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Sandbox checkout · official test cards only. No real money moves.</Text>
    {invoice.status === "PAID" ? <Text testID="payment-paid" style={[theme.text("h2"), { color: theme.colors.ink }]}>Payment confirmed</Text> : <>
      {pending ? <Text testID="payment-pending">{state === "checking" ? "Checking payment confirmation…" : "Awaiting payment confirmation. A delay does not mean your card was declined. Check again or return to this invoice later."}</Text> : null}
      {state === "cancelled" ? <Text testID="payment-cancelled">Checkout was closed or cancelled. Payment is unconfirmed. This invoice is saved; you can retry here.</Text> : null}
      {error ? <Text testID="payment-error" style={{ color: theme.colors.danger }}>{error}</Text> : null}
      {invoice.checkoutEligible ? <Button testID="pay-invoice" disabled={state === "opening" || state === "checking"}
        onPress={() => void pay()}>{state === "opening" ? "Opening checkout…" : state === "idle" ? "Pay with test card" : "Retry checkout"}</Button> :
        <Text testID="invoice-not-payable">{invoice.totalCentavos === 0 ? "No payment is due for this invoice." : "Test-card checkout is unavailable for this invoice."}</Text>}
      <Button variant="secondary" testID="check-payment" disabled={state === "opening" || state === "checking"} onPress={() => void checkAgain()}>Check again</Button>
    </>}
  </View>;
  return <InvoiceDetailScreen invoice={invoice} paymentContent={paymentContent} onDownloadReceipt={onDownloadReceipt} onBack={onBack} />;
}
