import React from "react";
import { Text, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import type { BookingServiceType } from "./bookingApi";
import type { EntitlementSummary } from "@autocare/contracts";

const pesos = (centavos: number) => `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

/**
 * M-19 — pick a service. Each service shows an "Included in your plan" badge when the member has a
 * remaining entitlement of the matching type, otherwise its cash price. Presentational: the
 * container supplies the data and the onSelect callback.
 */
export function ServiceTypeScreen({
  serviceTypes,
  entitlements,
  onSelect,
}: {
  serviceTypes: BookingServiceType[];
  entitlements: EntitlementSummary[];
  onSelect: (s: BookingServiceType) => void;
}) {
  const remainingFor = (type: string | null): number =>
    type ? (entitlements.find((e) => e.entitlementType === type)?.remaining ?? 0) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      testID="service-type-screen"
    >
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Book a service</Text>
      {serviceTypes.length === 0 && (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>No services available right now.</Text>
      )}
      {serviceTypes.map((s) => {
        const included = remainingFor(s.entitlementType) > 0;
        return (
          <Card
            key={s.id}
            testID={`service-${s.code}`}
            interactive
            onPress={() => onSelect(s)}
            style={{ minHeight: theme.minTarget, gap: 4 }}
          >
            <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{s.name}</Text>
            <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{s.standardDurationMin} min</Text>
            {included ? (
              <Text testID={`badge-${s.code}`} style={[theme.text("label"), { color: theme.colors.primary }]}>
                Included in your plan
              </Text>
            ) : (
              <Text testID={`price-${s.code}`} style={[theme.text("label"), { color: theme.colors.ink }]}>
                {pesos(s.priceCentavos)}
              </Text>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
