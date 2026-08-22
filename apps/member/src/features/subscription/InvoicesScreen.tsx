import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { theme } from "../../theme";
import { Invoice } from "@autocare/contracts";
import { formatCentavos } from "./formatCentavos";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function InvoiceRow({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  return (
    <Pressable testID={`invoice-${invoice.id}`} onPress={onPress}
      style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
        marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line,
        flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View>
        <Text style={[theme.text("code"), { color: theme.colors.ink }]}>{invoice.number}</Text>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>{formatDate(invoice.issuedAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{formatCentavos(invoice.totalCentavos)}</Text>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{invoice.status}</Text>
      </View>
    </Pressable>
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
