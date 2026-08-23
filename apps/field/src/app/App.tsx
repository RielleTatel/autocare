import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { fieldTheme } from "../theme";
import { StaffLoginScreen } from "../features/auth/StaffLoginScreen";
import { StaffHomeScreen } from "../features/home/StaffHomeScreen";
import { signInStaff } from "../features/auth/staffAuth";
import { bootstrapStaff, type StaffBootState } from "../features/auth/staffSession";
import { InspectionFlow } from "../features/inspection/InspectionFlow";
import { SyncQueueScreen } from "../features/sync/SyncQueueScreen";
import { startSyncListener } from "../shared/sync";

const Stack = createNativeStackNavigator();

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: fieldTheme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[fieldTheme.text("h1"), { color: fieldTheme.colors.primaryDeep }]}>AutoCare+ Field</Text>
    </View>
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
          const { role, name } = await signInStaff(email, password);
          setBoot({ state: "READY", name: name ?? null, role });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
        }
      }}
    />
  );
}

export default function App() {
  const [boot, setBoot] = useState<StaffBootState | "PENDING">("PENDING");

  useEffect(() => {
    bootstrapStaff().then(setBoot);
    startSyncListener();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {boot === "PENDING" ? (
        <Splash />
      ) : boot.state === "READY" ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">
            {({ navigation }) => (
              <StaffHomeScreen
                name={boot.name}
                role={boot.role}
                onStartInspection={() => navigation.navigate("Inspection")}
                onOpenSyncQueue={() => navigation.navigate("SyncQueue")}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Inspection">
            {({ navigation }) => <InspectionFlow onDone={() => navigation.navigate("Home")} />}
          </Stack.Screen>
          <Stack.Screen name="SyncQueue">
            {() => <SyncQueueScreen />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="StaffLogin">
            {() => <StaffLoginContainer setBoot={setBoot} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
