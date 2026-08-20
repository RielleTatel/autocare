import type { ComponentType } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { theme } from "../theme";

export type HomeTabsProps = {
  HomeComponent: ComponentType<any>;
  VehiclesComponent: ComponentType<any>;
  ProfileComponent: ComponentType<any>;
};

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = { Home: "🏠", Vehicles: "🚗", Profile: "👤" };

export function HomeTabs({ HomeComponent, VehiclesComponent, ProfileComponent }: HomeTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarStyle: { height: 49 },
        tabBarIcon: () => <Text>{icons[route.name] ?? "•"}</Text>,
      })}
    >
      {/* `children` (not `component`) so a fresh inline function from the caller
          doesn't read as a new component type and remount the tab on every render
          — see https://reactnavigation.org/docs/screen#children. */}
      <Tab.Screen name="Home">{(props) => <HomeComponent {...props} />}</Tab.Screen>
      <Tab.Screen name="Vehicles">{(props) => <VehiclesComponent {...props} />}</Tab.Screen>
      <Tab.Screen name="Profile">{(props) => <ProfileComponent {...props} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
