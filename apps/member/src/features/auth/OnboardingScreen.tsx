import { useRef, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../theme";
import { Button } from "../../components/Button";

const alwaysCaredFor = require("../../../assets/onboarding/always-cared-for.png");
const stayAhead = require("../../../assets/onboarding/stay-ahead.png");
const serviceAnywhere = require("../../../assets/onboarding/service-anywhere.png");

type Slide = {
  illustration: ImageSourcePropType;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    illustration: alwaysCaredFor,
    title: "Your car, always cared for",
    body: "Scheduled maintenance, trusted service, and roadside help — all in one place.",
  },
  {
    illustration: stayAhead,
    title: "Stay ahead of maintenance",
    body: "Know what needs attention before small issues grow into bigger problems.",
  },
  {
    illustration: serviceAnywhere,
    title: "Service wherever you are",
    body: "Book a mechanic where you need one and keep every service in one clear history.",
  },
];

export function OnboardingScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Some embedded previews report a zero window height during their first
  // layout pass. Width remains stable, and the floor prevents 0 × 0 artwork.
  const illustrationSize = Math.min(
    Math.max(width - theme.spacing.xl, 240),
    420,
  );

  const advance = () => {
    if (page === SLIDES.length - 1) {
      onGetStarted();
      return;
    }

    const nextPage = page + 1;
    setPage(nextPage);
    listRef.current?.scrollToIndex({ index: nextPage, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(event) => {
          setPage(Math.round(event.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item, index }) => (
          <View
            testID={`slide-${index}`}
            style={{
              width,
              paddingHorizontal: theme.spacing.lg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image
              testID={`illustration-${index}`}
              source={item.illustration}
              accessible={false}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              style={{ width: illustrationSize, height: illustrationSize }}
            />

            <View style={{ maxWidth: 380, alignItems: "center", gap: theme.spacing.sm }}>
              <Text
                accessibilityRole="header"
                style={[
                  theme.text("h1"),
                  { color: theme.colors.primaryDeep, textAlign: "center" },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  theme.text("body"),
                  { color: theme.colors.inkMuted, textAlign: "center", lineHeight: 25 },
                ]}
              >
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      <View
        style={{
          minHeight: 80,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.md,
        }}
      >
        <View
          accessible
          accessibilityLabel={`Onboarding page ${page + 1} of ${SLIDES.length}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          {SLIDES.map((slide, index) => (
            <View
              key={slide.title}
              testID={`dot-${index}`}
              style={{
                width: index === page ? 24 : 8,
                height: 8,
                borderRadius: theme.radii.pill,
                backgroundColor: index === page ? theme.colors.primary : theme.colors.line,
              }}
            />
          ))}
        </View>

        <Button
          style={{ width: 164 }}
          testID="get-started"
          accessibilityLabel={page === SLIDES.length - 1 ? "Get started" : "Next onboarding page"}
          onPress={advance}
        >
          {page === SLIDES.length - 1 ? "Get started" : "Next"}
        </Button>
      </View>
    </View>
  );
}
