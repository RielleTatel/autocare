import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { theme } from "../theme";
import { Icon, type IconName } from "./Icon";

/**
 * Member bottom tabs, per the design system's `shell/TabBar.jsx`: a 56dp bar
 * over a hairline, active tint Gauge Blue and inactive muted ink, 22dp icons
 * with an 11px label beneath. Labels are nouns, never verbs.
 *
 * Built as a custom renderer rather than styling the default bar because the
 * default gives no control over the icon/label pairing or the hairline.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = theme;

  return (
    <View
      style={{
        flexDirection: "row",
        height: 56 + insets.bottom,
        paddingBottom: insets.bottom,
        borderTopWidth: 1,
        borderTopColor: t.colors.line,
        backgroundColor: t.colors.surface,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
        const icon = (options as { tabBarIconName?: IconName }).tabBarIconName;
        const tint = focused ? t.colors.primary : t.colors.inkMuted;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
          >
            {icon ? <Icon name={icon} size={22} color={tint} /> : null}
            <Text style={{ ...t.text("label", focused ? 600 : 500), fontSize: 11, color: tint }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
