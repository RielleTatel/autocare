import { useEffect } from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { HomeTabs } from "./HomeTabs";

describe("HomeTabs", () => {
  it("does not remount the active tab's screen when the parent re-renders with the same component references", () => {
    // Regression guard: RootNavigator hands HomeTabs stable component
    // references (module-level functions read from context) rather than
    // fresh inline wrappers per render. If that regresses — or if HomeTabs
    // goes back to `component={...}` instead of `children={...}` — a screen
    // that fetches on mount would refetch/remount every time its parent
    // re-renders, which is exactly the infinite refetch loop this guards.
    let mounts = 0;
    function HomeProbe() {
      useEffect(() => { mounts += 1; }, []);
      return <Text>home</Text>;
    }
    function VehiclesProbe() { return <Text>vehicles</Text>; }
    function ProfileProbe() { return <Text>profile</Text>; }

    const { rerender } = render(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} ProfileComponent={ProfileProbe} />
      </NavigationContainer>
    );
    expect(mounts).toBe(1);

    // Same component references, just a fresh render pass of the parent tree.
    rerender(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} ProfileComponent={ProfileProbe} />
      </NavigationContainer>
    );
    rerender(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} ProfileComponent={ProfileProbe} />
      </NavigationContainer>
    );

    expect(mounts).toBe(1);
  });
});
