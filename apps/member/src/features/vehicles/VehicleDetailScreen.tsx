import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { Plate } from "../../components/Plate";
import { ApiError } from "@autocare/api-client";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";

function SpecRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.line }}>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{label}</Text>
      <Text style={[mono ? theme.text("code") : theme.text("body"), { color: theme.colors.ink }]}>{value}</Text>
    </View>
  );
}

/** Sentence case, at heading weight. An ALL-CAPS eyebrow over every block is
 *  decoration pretending to be structure. */
function SectionLabel({ children, onDark }: { children: string; onDark?: boolean }) {
  return (
    <Text style={[theme.text("h2"), { color: onDark ? theme.colors.ink : theme.colors.ink }]}>{children}</Text>
  );
}

/** One of the three numbers a member checks. Bare columns divided by hairlines,
 *  deliberately not three more cards — identical boxes would flatten the
 *  hierarchy the sheet is built to create. */
function Stat({ testID, value, label, last }: { testID: string; value: string; label: string; last?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 2,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: theme.colors.line,
      }}
    >
      <Text testID={testID} style={[theme.text("h2"), { color: theme.colors.ink }]}>{value}</Text>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{label}</Text>
    </View>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short" });

export function VehicleDetailScreen({ vehicle, health, openItems, lastServiceAt, onUpdateOdometer, onArchive, onArchived, onBack, onManageSubscription, onViewHealthScore, onBookService }: {
  vehicle: Vehicle;
  /** Latest score, when the vehicle has been inspected. Absent is normal for a
   *  new vehicle and must not read as an error. */
  health?: { score: number; band: Band } | null;
  /** Open attention items for this vehicle. Undefined = not loaded yet, which
   *  reads as "—" rather than a confident zero. */
  openItems?: number | null;
  lastServiceAt?: string | null;
  onUpdateOdometer: (km: number, justification?: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onArchived: () => void;
  onBack?: () => void;
  onManageSubscription?: () => void;
  onViewHealthScore?: () => void;
  onBookService?: () => void;
}) {
  const [editingOdo, setEditingOdo] = useState(false);
  const [odoValue, setOdoValue] = useState(String(vehicle.currentOdometerKm));
  const [justification, setJustification] = useState("");
  const [needsJustification, setNeedsJustification] = useState(false);
  const [odoError, setOdoError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const photo = vehicle.photoUrls[0];

  const submitOdometer = async () => {
    setOdoError(null);
    const km = Number(odoValue);
    try {
      await onUpdateOdometer(km, needsJustification ? justification : undefined);
      setEditingOdo(false);
      setNeedsJustification(false);
      setJustification("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ODOMETER_REGRESSION") {
        setNeedsJustification(true);
        setOdoError("This reading is lower than the last one — tell us why.");
      } else {
        setOdoError(e instanceof Error ? e.message : "Couldn't update odometer");
      }
    }
  };

  const confirmedArchive = async () => {
    await onArchive(vehicle.id);
    setConfirmArchive(false);
    onArchived();
  };

  const bandLabel = health ? theme.vhsBands[health.band].labelEn : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ paddingBottom: 96 }}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: 260 }} />
      ) : (
        /* An empty frame should still say what belongs in it. A flat grey slab
           reads as something that failed to load. */
        <View
          testID="no-photo"
          style={{
            width: "100%", height: 260,
            backgroundColor: theme.colors.chassis,
            alignItems: "center", justifyContent: "center", gap: theme.spacing.xs,
          }}
        >
          <Icon name="car-front" size={44} color={theme.colors.inkMuted} />
          <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>No photo yet</Text>
        </View>
      )}

      {/* Floating over the hero rather than in a bar above it: the photo is the
          full-bleed subject, and chrome sitting on it keeps it that way. */}
      {onBack ? (
        <Pressable
          testID="vehicle-back"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={{
            position: "absolute",
            top: theme.spacing.md,
            left: theme.spacing.md,
            width: theme.minTarget,
            height: theme.minTarget,
            borderRadius: theme.minTarget / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surface,
            // RN shadow props: `elevation.card` is a CSS box-shadow string and
            // does not cross over.
            shadowColor: theme.colors.ink,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Icon name="chevron-left" size={24} color={theme.colors.ink} />
        </Pressable>
      ) : null}

      {/* The detail sheet: one surface lifted over the photo, so the car is a
          backdrop and its condition is the subject. Overlapping the hero by a
          card radius is what makes the two read as one object rather than two
          stacked blocks. */}
      <View
        testID="vehicle-identity"
        style={{
          marginTop: -28,
          minHeight: 460,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Plate variant="chip">{vehicle.plateNo}</Plate>
          <Pressable testID="overflow-menu" accessibilityRole="button" accessibilityLabel="Vehicle options"
            onPress={() => setMenuOpen((o) => !o)}
            style={{ width: theme.minTarget, height: theme.minTarget, alignItems: "center", justifyContent: "center" }}>
            <Icon name="ellipsis" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.text("h1"), { color: theme.colors.ink }]}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>

          {health ? (
            /* The score is the largest thing on the screen — a maintenance app
               answers "how is it?" before "what is it?". On this light sheet the
               numeral is painted in the band's own light-surface colour (5.6:1
               at worst), so the score states its band in one mark instead of
               repeating it in a chip alongside. */
            <Pressable
              accessibilityRole={onViewHealthScore ? "button" : undefined}
              accessibilityLabel={`Health score ${health.score} out of 100, ${bandLabel}`}
              onPress={onViewHealthScore}
              style={{ flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm }}
            >
              <Text
                testID="vehicle-score"
                style={[theme.text("score"), { color: theme.vhsBands[health.band].text, lineHeight: 76 }]}
              >
                {health.score}
              </Text>
              <View style={{ paddingBottom: theme.spacing.sm, gap: 2 }}>
                <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>out of 100</Text>
                <Text testID="vehicle-band" style={[theme.text("body", 600), { color: theme.vhsBands[health.band].text }]}>
                  {bandLabel}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>
              No health score yet — it appears after the first inspection.
            </Text>
          )}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel onDark>Overview</SectionLabel>
          <View style={{ flexDirection: "row", alignItems: "stretch" }}>
            <Stat
              testID="stat-odometer"
              value={`${(vehicle.currentOdometerKm / 1000).toFixed(1)}k`}
              label="km on the clock"
            />
            <Stat
              testID="stat-last-service"
              value={lastServiceAt ? shortDate(lastServiceAt) : "—"}
              label="last service"
            />
            <Stat
              testID="stat-watch"
              value={openItems == null ? "—" : String(openItems)}
              label={openItems === 1 ? "item to watch" : "items to watch"}
              last
            />
          </View>
        </View>

        {menuOpen && (
          <Pressable testID="archive-action" onPress={() => { setMenuOpen(false); setConfirmArchive(true); }}
            style={{ height: theme.minTarget, justifyContent: "center" }}>
            <Text style={[theme.text("body"), { color: theme.colors.danger }]}>Archive vehicle</Text>
          </Pressable>
        )}

        {confirmArchive && (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
            marginTop: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line }}>
            <Text style={[theme.text("body"), { color: theme.colors.ink }]}>
              Archive this vehicle? Its history is kept.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Pressable testID="archive-cancel" onPress={() => setConfirmArchive(false)}
                style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
                <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable testID="archive-confirm" onPress={confirmedArchive}
                style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
                <Text style={[theme.text("body", 600), { color: theme.colors.danger }]}>Archive</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ gap: theme.spacing.xs }}>
          <SectionLabel>Specifications</SectionLabel>
          <Card>
            <SpecRow label="Fuel" value={vehicle.fuelType} />
            <SpecRow label="Transmission" value={vehicle.transmission} />
            <SpecRow label="Variant" value={vehicle.variant ?? "—"} />
            <SpecRow label="VIN" value={vehicle.vin ?? "—"} mono last />
          </Card>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text testID="identity-odometer" style={[theme.text("code"), { color: theme.colors.inkMuted }]}>
            {vehicle.currentOdometerKm.toLocaleString("en-US")} km
          </Text>
          {editingOdo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <TextInput testID="odometer-input" keyboardType="number-pad" value={odoValue} onChangeText={setOdoValue}
                style={[theme.text("body"), { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.sm,
                  paddingHorizontal: theme.spacing.sm, height: theme.minTarget, minWidth: 100 }]} />
              <Pressable testID="odometer-save" onPress={submitOdometer}
                style={{ height: theme.minTarget, justifyContent: "center" }}>
                <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable testID="odometer-update" onPress={() => setEditingOdo(true)}
              style={{ height: theme.minTarget, justifyContent: "center" }}>
              <Text style={[theme.text("body"), { color: theme.colors.primary }]}>
                {vehicle.currentOdometerKm.toLocaleString("en-US")} km · Update
              </Text>
            </Pressable>
          )}
        </View>

        {needsJustification && (
          <View style={{ marginTop: theme.spacing.sm }}>
            <TextInput testID="odometer-justification" placeholder="Why is this reading lower? (e.g. odometer replaced)"
              value={justification} onChangeText={setJustification}
              style={[theme.text("body"), { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.sm,
                padding: theme.spacing.sm, minHeight: theme.minTarget }]} multiline />
            <Pressable testID="odometer-retry" onPress={submitOdometer}
              style={{ height: theme.minTarget, justifyContent: "center" }}>
              <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>Retry with justification</Text>
            </Pressable>
          </View>
        )}

        {odoError ? (
          <Text testID="odometer-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.xs }]}>
            {odoError}
          </Text>
        ) : null}

        {onViewHealthScore ? (
          <Card testID="view-health-score" interactive onPress={onViewHealthScore}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 2 }}>
              <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
              {health ? (
                <Text testID="health-summary" style={[theme.text("label"), { color: theme.colors.inkMuted }]}>
                  {health.score} / 100 · {theme.vhsBands[health.band].labelEn}
                </Text>
              ) : null}
            </View>
            <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>
              {health ? "View report →" : "View →"}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
              Coming with your first inspection
            </Text>
          </Card>
        )}

        {onManageSubscription ? (
          <Button block variant="ghost" testID="manage-subscription" onPress={onManageSubscription}>
            Manage subscription
          </Button>
        ) : null}
      </View>
    </ScrollView>

    {/* One action, always reachable. The page previously ended in a list of
        facts with nothing to do about them. */}
    {onBookService ? (
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.line,
        }}
      >
        <Button block testID="vehicle-book-service" onPress={onBookService}>
          Book a service
        </Button>
      </View>
    ) : null}
    </View>
  );
}
