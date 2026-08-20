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
      <Tab.Screen name="Home" component={HomeComponent} />
      <Tab.Screen name="Vehicles" component={VehiclesComponent} />
      <Tab.Screen name="Profile" component={ProfileComponent} />
    </Tab.Navigator>
  );
}
