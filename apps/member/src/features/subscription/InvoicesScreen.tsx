import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { Invoice } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";

/** Invoice lifecycle → the generic pill tones. Settled is success, anything the
 *  member must act on is danger, everything mid-flight stays neutral. */
const STATUS_TONE: Record<string, "success" | "danger" | "warn" | "neutral"> = {
  PAID: "success",
  GRACE: "warn",
  RETRYING: "warn",
  PAST_DUE: "danger",
  SUSPENDED: "danger",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function InvoiceRow({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  return (
    <Card
      testID={`invoice-${invoice.id}`}
      interactive
      onPress={onPress}
      style={{ marginBottom: theme.spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
    >
      <View>
        {/* Invoice numbers are machine identity, same as a plate. */}
        <Plate variant="plain">{invoice.number}</Plate>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>{formatDate(invoice.issuedAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: theme.spacing.xs }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{formatCentavos(invoice.totalCentavos)}</Text>
        <StatusPill tone={STATUS_TONE[invoice.status] ?? "neutral"}>{invoice.status.replace(/_/g, " ")}</StatusPill>
      </View>
    </Card>
  );
}

export function InvoicesScreen({ fetchInvoices, onSelectInvoice }: {
  fetchInvoices: () => Promise<Invoice[]>;
  onSelectInvoice: (invoice: Invoice) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchInvoices();
    setInvoices(list);
  }, [fetchInvoices]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      <FlatList
        data={invoices ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <InvoiceRow invoice={item} onPress={() => onSelectInvoice(item)} />}
        ListHeaderComponent={<Text style={[theme.text("h1"), { color: theme.colors.primaryDeep, marginBottom: theme.spacing.md }]}>Invoices</Text>}
        ListEmptyComponent={
          invoices && invoices.length === 0 ? (
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xxl, textAlign: "center" }]}>
              No invoices yet
            </Text>
          ) : null
        }
      />
    </View>
  );
}
