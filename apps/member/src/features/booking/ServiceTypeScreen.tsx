import React from "react";
import { Text, View, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import type { BookingServiceType } from "./bookingApi";
import type { EntitlementSummary } from "@autocare/contracts";
import { serviceIcon, serviceTint } from "./serviceIcon";

const pesos = (centavos: number) => `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function ChevronPill() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: theme.radii.pill, backgroundColor: theme.colors.ink, alignItems: "center", justifyContent: "center" }}>
      <Icon name="chevron-right" size={20} color={theme.colors.surface} />
    </View>
  );
}

/**
 * M-19 — pick a service. Each service shows an "Included in your plan" badge when the member has a
 * remaining entitlement of the matching type, otherwise its cash price. Presentational: the
 * container supplies the data and the onSelect callback.
 */
export function ServiceTypeScreen({
  serviceTypes,
  entitlements,
  plateNo,
  onSelect,
}: {
  serviceTypes: BookingServiceType[];
  entitlements: EntitlementSummary[];
  /** Shown in the subtitle so the choice keeps its subject in view. */
  plateNo?: string;
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
      <View style={{ gap: 2 }}>
        <Text style={[theme.text("h1"), { color: theme.colors.ink }]}>Book a service</Text>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>
          {plateNo ? `What does ${plateNo} need today?` : "What does your vehicle need today?"}
        </Text>
      </View>
      {serviceTypes.length === 0 && (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>No services available right now.</Text>
      )}
      {serviceTypes.map((s) => {
        const included = remainingFor(s.entitlementType) > 0;
        const glyph = serviceIcon(s.code, s.name);
        const tint = serviceTint(glyph);
        return (
          <Card
            key={s.id}
            testID={`service-${s.code}`}
            interactive
            onPress={() => onSelect(s)}
            style={{ minHeight: theme.minTarget, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}
          >
            {/* The tile carries the service's own colour; "included in your
                plan" is said in words below, not by tinting the tile brand-red,
                so entitlement and service identity stay separate signals. */}
            <View
              style={{
                width: 58, height: 58, borderRadius: theme.radii.md,
                backgroundColor: tint.bg,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name={glyph} size={26} color={tint.fg} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{s.name}</Text>
              <Text style={[theme.text("label"), { color: theme.colors.inkFaint }]}>Time: {s.standardDurationMin} min</Text>
              {included ? (
                <Text testID={`badge-${s.code}`} style={[theme.text("label", 600), { color: theme.colors.success }]}>
                  Included in your plan
                </Text>
              ) : (
                <Text testID={`price-${s.code}`} style={[theme.text("label", 600), { color: theme.colors.ink }]}>
                  {pesos(s.priceCentavos)}
                </Text>
              )}
            </View>
            <ChevronPill />
          </Card>
        );
      })}
    </ScrollView>
  );
}
