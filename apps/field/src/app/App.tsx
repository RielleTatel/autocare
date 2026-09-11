import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { useFonts } from "expo-font";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { fieldTheme } from "../theme";
import { fontAssets } from "../theme/fonts";
import { StaffLoginScreen } from "../features/auth/StaffLoginScreen";
import { TaskListScreen } from "../features/tasks/TaskListScreen";
import { signInStaff, signOutStaff } from "../features/auth/staffAuth";
import { bootstrapStaff, type StaffBootState } from "../features/auth/staffSession";
import { InspectionFlow } from "../features/inspection/InspectionFlow";
import { SyncQueueScreen } from "../features/sync/SyncQueueScreen";
import { RoadsideContainer } from "../features/roadside/RoadsideContainer";
import { InspectionDetailScreen } from "../features/history/InspectionDetailScreen";
import { startSyncListener } from "../shared/sync";

const Stack = createNativeStackNavigator();

/**
 * Every stack screen clears the status bar / notch here rather than each screen
 * padding itself — a screen added later inherits it instead of forgetting it.
 * FieldNav sits at the top of most screens and was running under the clock.
 */
function useScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    contentStyle: { paddingTop: insets.top, backgroundColor: fieldTheme.colors.chassis },
  } as const;
}

function Splash() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: fieldTheme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[fieldTheme.text("h1"), { color: fieldTheme.colors.primaryDeep }]}>AutoCare+ Field</Text>
    </SafeAreaView>
  );
}

function StaffLoginContainer({ setBoot }: { setBoot: (b: StaffBootState) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <StaffLoginScreen
      error={error}
      onSubmit={async (email, password) => {
        setError(null);
        try {
          const { id, role, name } = await signInStaff(email, password);
          setBoot({ state: "READY", id, name: name ?? null, role });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
        }
      }}
    />
  );
}

/** Inside the provider, so useScreenOptions has an ancestor to read from. */
function AppShell() {
  const [boot, setBoot] = useState<StaffBootState | "PENDING">("PENDING");
  // Every screen styles text through fieldTheme.text(), which names the Barlow
  // / Inter / IBM Plex faces directly. Rendering before they register shows a
  // frame of system-font fallback and reflow. `fontError` counts as loaded on
  // purpose: a missing face should degrade to the system font, never to a
  // permanently blank app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const screenOptions = useScreenOptions();

  useEffect(() => {
    bootstrapStaff().then(setBoot);
    startSyncListener();
  }, []);

  if (!fontsLoaded && !fontError) return <Splash />;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {boot === "PENDING" ? (
        <Splash />
      ) : boot.state === "READY" ? (
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="Home">
            {({ navigation }) => (
              <TaskListScreen
                name={boot.name}
                role={boot.role}
                onStartInspection={(from) => navigation.navigate("Inspection", from ?? {})}
                onOpenSyncQueue={() => navigation.navigate("SyncQueue")}
                onOpenRoadside={() => navigation.navigate("Roadside")}
                onLogout={() => {
                  void signOutStaff().then(() => setBoot({ state: "ANONYMOUS" }));
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Inspection">
            {({ navigation, route }) => (
              <InspectionFlow
                initialVehicleId={(route.params as { vehicleId?: string } | undefined)?.vehicleId}
                initialAppointmentId={(route.params as { appointmentId?: string } | undefined)?.appointmentId}
                onOpenInspection={(vehicleId, inspectionId) => navigation.navigate("InspectionDetail", { vehicleId, inspectionId })}
                onDone={() => navigation.popToTop()}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="InspectionDetail">
            {({ navigation, route }) => {
              const p = route.params as { vehicleId: string; inspectionId: string };
              return (
                <InspectionDetailScreen
                  vehicleId={p.vehicleId}
                  inspectionId={p.inspectionId}
                  onBack={() => navigation.goBack()}
                />
              );
            }}
          </Stack.Screen>
          <Stack.Screen name="Roadside">
            {({ navigation }) => (
              <RoadsideContainer userId={boot.id} role={boot.role} onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>
          <Stack.Screen name="SyncQueue">
            {/* onBack was missing, leaving the screen with no affordance back. */}
            {({ navigation }) => <SyncQueueScreen onBack={() => navigation.goBack()} />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="StaffLogin">
            {() => <StaffLoginContainer setBoot={setBoot} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  // Screens read the status bar / notch insets from here. Without a provider
  // useSafeAreaInsets returns zeros, so content ran under the clock.
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}
