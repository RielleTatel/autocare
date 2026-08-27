import { useEffect } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
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
    function BookingsProbe() { return <Text>bookings</Text>; }
    function AccountProbe() { return <Text>account</Text>; }

    const { rerender } = render(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} BookingsComponent={BookingsProbe} AccountComponent={AccountProbe} />
      </NavigationContainer>
    );
    expect(mounts).toBe(1);

    // Same component references, just a fresh render pass of the parent tree.
    rerender(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} BookingsComponent={BookingsProbe} AccountComponent={AccountProbe} />
      </NavigationContainer>
    );
    rerender(
      <NavigationContainer>
        <HomeTabs HomeComponent={HomeProbe} VehiclesComponent={VehiclesProbe} BookingsComponent={BookingsProbe} AccountComponent={AccountProbe} />
      </NavigationContainer>
    );

    expect(mounts).toBe(1);
  });

  it("shows the four tabs from the screen inventory, labelled as nouns", () => {
    const P = (label: string) => () => <Text>{label}</Text>;
    render(
      <NavigationContainer>
        <HomeTabs
          HomeComponent={P("home")}
          VehiclesComponent={P("vehicles")}
          BookingsComponent={P("bookings")}
          AccountComponent={P("account")}
        />
      </NavigationContainer>
    );
    for (const label of ["Home", "My Vehicles", "Bookings", "Account"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("switches tabs on press", () => {
    const P = (label: string) => () => <Text>{label}</Text>;
    render(
      <NavigationContainer>
        <HomeTabs
          HomeComponent={P("home")}
          VehiclesComponent={P("vehicles")}
          BookingsComponent={P("bookings")}
          AccountComponent={P("account")}
        />
      </NavigationContainer>
    );
    expect(screen.getByTestId("tab-Home").props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId("tab-Bookings"));
    expect(screen.getByText("bookings")).toBeTruthy();
    expect(screen.getByTestId("tab-Bookings").props.accessibilityState).toMatchObject({ selected: true });
  });
});
