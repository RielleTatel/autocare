import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View } from "react-native";
import { theme } from "../../theme";

const CARDS = [
  { title: "Your car, always cared for", body: "Scheduled maintenance, pickup & delivery, roadside help — one subscription." },
  { title: "Know your car's health", body: "Every inspection produces a 0–100 Vehicle Health Score you can track and share." },
  { title: "Built for Zamboanga", body: "Local workshop, certified mechanics, service at your door." },
];

export function OnboardingScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [page, setPage] = useState(0);
  const width = useRef(Dimensions.get("window").width).current;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      <FlatList
        data={CARDS}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, padding: theme.spacing.lg, justifyContent: "center" }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.lg }}>
              <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep, marginBottom: theme.spacing.sm }]}>
                {item.title}
              </Text>
              <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>{item.body}</Text>
            </View>
          </View>
        )}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: theme.spacing.md }}>
        {CARDS.map((c, i) => (
          <View
            key={c.title}
            testID={`dot-${i}`}
            style={{
              width: 8, height: 8, borderRadius: 4, marginHorizontal: 4,
              backgroundColor: i === page ? theme.colors.primary : theme.colors.line,
            }}
          />
        ))}
      </View>
      <Pressable testID="get-started" onPress={onGetStarted}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginHorizontal: theme.spacing.lg,
                 marginBottom: theme.spacing.lg, backgroundColor: theme.colors.primary,
                 alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Get started</Text>
      </Pressable>
    </View>
  );
}
