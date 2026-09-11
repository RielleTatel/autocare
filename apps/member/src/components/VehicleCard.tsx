import { useId, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import { theme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { StarRating } from "../features/health-score/StarRating";
import { vehicleGradient } from "./vehicleGradient";

/**
 * On this card the accent is a lifted Ignition Red, not `colors.primary`.
 *
 * #D9273F reaches only 2.5:1 on the card fields and the dark-theme
 * `--ac-primary` #F0576B only 2.8:1 on the lightest of them — both under the
 * 3:1 a meaningful graphic needs. #FF7A88 is the same hue carried far enough to
 * clear 3.6:1 against every stop in the palette.
 */
const ON_DARK_ACCENT = "#FF7A88";

/** Hairlines and fills for pills sitting on the gradient. Kept as literal
 *  translucent white rather than tokens: the token set has no on-dark surface
 *  scale, and a flat tint would band against the gradient. */
const PILL_FILL = "rgba(255,255,255,0.07)";
const PILL_LINE = "rgba(255,255,255,0.16)";

function Pill({ icon, children, mono }: { icon?: IconName; children: string; mono?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: PILL_FILL,
        borderWidth: theme.borders.hairline, borderColor: PILL_LINE,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.md, paddingVertical: 9,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={theme.colors.onPrimary} /> : null}
      <Text style={[mono ? theme.text("code") : theme.text("label", 600), { color: theme.colors.onPrimary }]}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The vehicle as an object, not a row: a dark brand-gradient card carrying the
 * name, its trim, and the three facts a member checks at a glance.
 *
 * There is no vehicle photography in the product, so the gradient is the whole
 * surface and the star rating fills the space a hero image would occupy —
 * product data rather than decoration, which keeps the card from reading as a
 * frame around nothing.
 */
export function VehicleCard({
  vehicle, health, onPress, testID, style,
}: {
  vehicle: Vehicle;
  /** Latest score for this vehicle. Omit and the band pill and stars are dropped
   *  rather than faked — an uninspected vehicle has no score to show. */
  health?: { score: number; band: Band } | null;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
}) {
  const t = theme;
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  // The trim is the reference's "2024 S580" line. Without one the plate is the
  // next most identifying thing, and never a blank row.
  const subtitle = vehicle.variant ?? vehicle.plateNo;
  const band = health ? t.vhsBands[health.band] : null;
  const field = vehicleGradient(vehicle.id);

  // SVG ids share one namespace across the whole react-native-svg tree, so a
  // fixed id would make every card on the vehicles list paint itself with the
  // first card's gradient.
  const gradientId = `vehicleCard-${useId()}`;

  // react-native-svg does not resolve a percentage width on the root <Svg>
  // against an absolutely-positioned parent — it lays out at some intrinsic
  // size, which left the gradient covering only part of the card and dropped
  // the last pill onto bare chassis grey as unreadable white-on-light. Measure
  // the card and paint it in real pixels.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev?.w === width && prev?.h === height ? prev : { w: width, h: height }));
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        health
          ? `${title}, health score ${health.score}, ${band?.labelEn}`
          : `${title}, not yet inspected`
      }
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => [
        {
          borderRadius: t.radii.lg,
          borderWidth: t.borders.control,
          borderColor: ON_DARK_ACCENT,
          padding: t.spacing.lg,
          gap: t.spacing.lg,
          overflow: "hidden",
          // Also the first-frame and fallback paint: if the gradient layer is
          // ever missing the card is still dark, never white under white text.
          backgroundColor: field.from,
        },
        pressed && onPress ? { opacity: t.motion.pressOpacity } : null,
        style,
      ]}
    >
      {/* The gradient is a painted layer, not a background prop — RN has no
          gradient fill, and react-native-svg is already a dependency here. */}
      {size ? (
        <Svg style={{ position: "absolute", top: 0, left: 0 }} width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={field.from} />
              <Stop offset="1" stopColor={field.to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[t.text("h1"), { color: t.colors.onPrimary }]} numberOfLines={2}>{title}</Text>
          <Text style={[t.text("body"), { color: "#E4C9CE" }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        {onPress ? (
          // Decorative: the whole card is already the button, and its label
          // carries the destination. A second focus target would announce twice.
          <View
            style={{
              width: 48, height: 48, borderRadius: t.radii.pill,
              borderWidth: t.borders.control, borderColor: ON_DARK_ACCENT,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="arrow-up-right" size={22} color={ON_DARK_ACCENT} />
          </View>
        ) : null}
      </View>

      {health ? (
        <View style={{ alignItems: "center", paddingVertical: t.spacing.sm }}>
          <StarRating score={health.score} band={health.band} size={28} />
        </View>
      ) : null}

      {/* Wraps by design. The reference fits three pills on one line because its
          labels are short; ours carry real values — "Needs attention" and a
          six-figure odometer will not share a row at any sane padding. Letting
          identity and usage sit together and the condition drop to its own line
          reads as grouping; forcing one row would truncate the band word, and
          principle 1 requires the band colour always ship with it. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
        <Pill mono>{vehicle.plateNo}</Pill>
        <Pill icon="gauge">{`${vehicle.currentOdometerKm.toLocaleString("en-US")} km`}</Pill>
        {band && health ? (
          // The one saturated element: a protected band fill, always shipped
          // with its word. The hairline keeps the pill's shape readable even
          // for the darkest bands, which sit close to the card itself.
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: band.fill,
              borderWidth: t.borders.hairline, borderColor: PILL_LINE,
              borderRadius: t.radii.pill,
              paddingHorizontal: t.spacing.md, paddingVertical: 9,
            }}
          >
            <Text style={[t.text("label", 600), { color: band.on }]}>{band.labelEn}</Text>
            <Text style={[t.text("code"), { color: band.on }]}>{health.score}</Text>
          </View>
        ) : (
          <Pill icon="circle-help">Not yet inspected</Pill>
        )}
      </View>
    </Pressable>
  );
}
