import { useRef, useState } from "react";
import { Dimensions, FlatList, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Icon, type IconName } from "../../components/Icon";

/**
 * Three slides, each a single idea: what AutoCare is, what it watches, what it
 * does. The hero is a large glyph on the app's deep chrome — the same
 * primaryDeep that carries the Home masthead — so the set reads as one system
 * rather than three decorated pages.
 */
const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "car-front",
    title: "Your car, always cared for",
    body: "Scheduled maintenance, service, and roadside assistance — all in one place.",
  },
  {
    icon: "triangle-alert",
    title: "Stay ahead of maintenance",
    body: "Know what needs attention before small issues become bigger problems.",
  },
  {
    icon: "wrench",
    title: "Service when you need it",
    body: "Book maintenance and keep track of your vehicle's service history.",
  },
];

const HERO = 132;

export function OnboardingScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [page, setPage] = useState(0);
  const width = useRef(Dimensions.get("window").width).current;
  const t = theme;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FlatList
        data={SLIDES}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View
            testID={`slide-${index}`}
            style={{
              width,
              paddingHorizontal: t.spacing.lg,
              justifyContent: "center",
              alignItems: "center",
              gap: t.spacing.lg,
            }}
          >
            {/* The hero carries the slide. No card: a bordered box inside a
                full-bleed slide adds an edge that means nothing here. */}
            <View
              style={{
                width: HERO,
                height: HERO,
                borderRadius: HERO / 2,
                backgroundColor: t.colors.primaryDeep,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={item.icon} size={56} color={t.colors.onPrimary} />
            </View>

            <View style={{ gap: t.spacing.sm }}>
              <Text style={[t.text("h1"), { color: t.colors.primaryDeep, textAlign: "center" }]}>
                {item.title}
              </Text>
              <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center" }]}>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Dots sit directly under the copy they index, not adrift at the screen
          foot — and above the CTA, so the eye travels content → position → act. */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: t.spacing.lg }}>
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            testID={`dot-${i}`}
            style={{
              width: i === page ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === page ? t.colors.primary : t.colors.line,
            }}
          />
        ))}
      </View>

      <Button
        block
        style={{ marginHorizontal: t.spacing.lg, marginBottom: t.spacing.lg }}
        testID="get-started"
        onPress={onGetStarted}
      >
        Get started
      </Button>
    </View>
  );
}
