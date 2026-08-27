import type { ComponentType } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TabBar } from "../components/TabBar";
import type { IconName } from "../components/Icon";

export type HomeTabsProps = {
  HomeComponent: ComponentType<any>;
  VehiclesComponent: ComponentType<any>;
  BookingsComponent: ComponentType<any>;
  AccountComponent: ComponentType<any>;
};

const Tab = createBottomTabNavigator();

/** Four tabs per the screen inventory the design system's member kit follows. */
const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: "Home", label: "Home", icon: "house" },
  { name: "Vehicles", label: "My Vehicles", icon: "car-front" },
  { name: "Bookings", label: "Bookings", icon: "calendar-days" },
  { name: "Account", label: "Account", icon: "user" },
];

export function HomeTabs({ HomeComponent, VehiclesComponent, BookingsComponent, AccountComponent }: HomeTabsProps) {
  const screens: Record<string, ComponentType<any>> = {
    Home: HomeComponent,
    Vehicles: VehiclesComponent,
    Bookings: BookingsComponent,
    Account: AccountComponent,
  };

  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      {TABS.map(({ name, label, icon }) => {
        const Screen = screens[name];
        return (
          // `children` (not `component`) so a fresh inline function from the caller
          // doesn't read as a new component type and remount the tab on every render
          // — see https://reactnavigation.org/docs/screen#children.
          <Tab.Screen
            key={name}
            name={name}
            options={{ tabBarLabel: label, tabBarIconName: icon } as object}
          >
            {(props) => <Screen {...props} />}
          </Tab.Screen>
        );
      })}
    </Tab.Navigator>
  );
}
