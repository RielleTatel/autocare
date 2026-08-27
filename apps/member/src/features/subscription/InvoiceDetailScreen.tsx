import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Invoice } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function InvoiceDetailScreen({ invoice, onDownloadReceipt, onBack }: {
  invoice: Invoice;
  /** Fetches GET /invoices/:id/pdf and opens/shares the returned signed URL — implemented by the container. */
  onDownloadReceipt: () => Promise<void>;
  onBack?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onDownloadReceipt();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the receipt. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      {onBack ? (
        <Pressable testID="invoice-back" onPress={onBack} style={{ height: theme.minTarget, justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.primary }]}>{"< Back"}</Text>
        </Pressable>
      ) : null}

      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>{invoice.number}</Text>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
        Issued {formatDate(invoice.issuedAt)} · {invoice.status}
      </Text>

      <View style={{ marginTop: theme.spacing.lg }}>
        {invoice.items.map((item) => (
          <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm,
            borderBottomWidth: 1, borderBottomColor: theme.colors.line }}>
            <Text style={[theme.text("body"), { color: theme.colors.ink, flex: 1 }]}>{item.description} {item.qty > 1 ? `×${item.qty}` : ""}</Text>
            <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{formatCentavos(item.unitPriceCentavos * item.qty + item.taxCentavos)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.md }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Total</Text>
        <Text testID="invoice-total" style={[theme.text("h2"), { color: theme.colors.ink }]}>{formatCentavos(invoice.totalCentavos)}</Text>
      </View>

      {error ? (
        <Text testID="download-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>{error}</Text>
      ) : null}

      <Pressable testID="download-receipt" disabled={downloading} onPress={handleDownload}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
          backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body", 600), { color: theme.colors.onPrimary }]}>
          {downloading ? "Opening…" : "Download / Share receipt"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
