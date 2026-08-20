import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { bootstrap, type BootState } from "../features/auth/session";
import { sendOtp, signInWithGoogle, signOut } from "../features/auth/firebaseAuth";
import { api } from "../shared/api";
import { Vehicle } from "@autocare/contracts";
import { OnboardingScreen } from "../features/auth/OnboardingScreen";
import { PhoneEntryScreen } from "../features/auth/PhoneEntryScreen";
import { OtpScreen } from "../features/auth/OtpScreen";
import { ConsentScreen } from "../features/auth/ConsentScreen";
import { HomeTabs } from "./HomeTabs";
import { HomeScreen } from "../features/home/HomeScreen";
import { AddVehicleScreen } from "../features/vehicles/AddVehicleScreen";
import { VehiclePhotosScreen } from "../features/vehicles/VehiclePhotosScreen";
import { VehiclesListScreen } from "../features/vehicles/VehiclesListScreen";
import { VehicleDetailScreen } from "../features/vehicles/VehicleDetailScreen";
import { uploadVehiclePhoto } from "../features/vehicles/uploadPhoto";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { PrivacyScreen } from "../features/profile/PrivacyScreen";

const Stack = createNativeStackNavigator();

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>AutoCare+</Text>
    </View>
  );
}

/** After Firebase sign-in, ask the API for a session and route by consentRequired.
 * Transitions RootNavigator's top-level boot state rather than navigating within
 * the current (soon-to-be-unmounted) stack, so READY mounts the real vehicle stack. */
async function afterSignIn(navigation: any, setBootState: (s: BootState) => void) {
  const session = await api.createSession();
  if (session.consentRequired) {
    setBootState("NEEDS_CONSENT");
  } else {
    setBootState("READY");
  }
}

function OnboardingContainer({ navigation }: any) {
  return <OnboardingScreen onGetStarted={() => navigation.navigate("PhoneEntry")} />;
}

function PhoneEntryContainer({ navigation, setBootState }: any) {
  const [error, setError] = useState<string | null>(null);
  return (
    <PhoneEntryScreen
      error={error}
      onSubmit={async (phoneE164) => {
        setError(null);
        try {
          const confirmation = await sendOtp(phoneE164);
          navigation.navigate("Otp", { phone: phoneE164, confirmation });
        } catch {
          setError("Couldn't send the code. Check the number and try again.");
        }
      }}
      onGoogle={async () => {
        setError(null);
        try {
          await signInWithGoogle();
          await afterSignIn(navigation, setBootState);
        } catch {
          setError("Google sign-in failed. Try again.");
        }
      }}
    />
  );
}

function OtpContainer({ navigation, route, setBootState }: any) {
  const { phone, confirmation } = route.params;
  const [error, setError] = useState<string | null>(null);
  return (
    <OtpScreen
      phone={phone}
      error={error}
      onConfirm={async (code: string) => {
        setError(null);
        try {
          await confirmation.confirm(code);
          await afterSignIn(navigation, setBootState);
        } catch {
          setError("That code didn't work, try again.");
        }
      }}
      onResend={async () => {
        try {
          const next = await sendOtp(phone);
          navigation.setParams({ confirmation: next });
        } catch {
          setError("Couldn't resend the code. Try again.");
        }
      }}
    />
  );
}

function ConsentContainer({ setBootState }: any) {
  return <ConsentScreen onConsented={() => setBootState("READY")} />;
}

function HomePlaceholder() {
  // Used pre-READY (ANONYMOUS/NEEDS_CONSENT stacks reset to "Home" before the
  // READY vehicle data is available).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Home</Text>
    </View>
  );
}

/** Shared data for everything under the READY vehicle stack, provided once by
 * `ReadyStack` and read via `useReady()`. Keeping this in context — rather than
 * threading `vehicles`/`refreshVehicles`/etc. through inline wrapper components
 * passed as `HomeTabs`'s `*Component` props — is what keeps those props'
 * identities stable across renders. An inline `(props) => <X vehicles={vehicles} />`
 * defined fresh in the parent's render body is itself a *new component type*
 * every time `vehicles` changes, and React (independent of React Navigation)
 * remounts on a type change — which re-ran each tab's mount-time fetch effect,
 * which updated `vehicles` again, which re-created the wrapper again: an
 * infinite refetch/remount loop. Module-level components read from context
 * instead, so their identity never changes — only the context value updates,
 * which re-renders (not remounts) the consumers. */
const ReadyContext = createContext<{
  vehicles: Vehicle[];
  refreshVehicles: () => Promise<Vehicle[]>;
  firstName: string;
  setBootState: (s: BootState) => void;
} | null>(null);

function useReady() {
  const ctx = useContext(ReadyContext);
  if (!ctx) throw new Error("useReady() called outside ReadyContext.Provider");
  return ctx;
}

/** Home tab container: needs the vehicle list (for the primary card) and stack nav to reach AddVehicle/Detail. */
function HomeTabContainer({ navigation }: any) {
  const { vehicles, firstName } = useReady();
  return (
    <HomeScreen
      firstName={firstName}
      vehicle={vehicles[0] ?? null}
      onAddVehicle={() => navigation.getParent()?.navigate("AddVehicle")}
      onUpdateOdometer={() =>
        vehicles[0]
          ? navigation.getParent()?.navigate("VehicleDetail", { vehicle: vehicles[0] })
          : navigation.getParent()?.navigate("AddVehicle")
      }
    />
  );
}

function VehiclesTabContainer({ navigation }: any) {
  const { refreshVehicles } = useReady();
  return (
    <VehiclesListScreen
      fetchVehicles={refreshVehicles}
      onSelectVehicle={(vehicle: Vehicle) => navigation.getParent()?.navigate("VehicleDetail", { vehicle })}
      onAddVehicle={() => navigation.getParent()?.navigate("AddVehicle")}
    />
  );
}

function ProfileTabContainer({ navigation }: any) {
  const { setBootState } = useReady();
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => { api.get("/users/me").then(setProfile).catch(() => setProfile({})); }, []);
  return (
    <ProfileScreen
      initialProfile={profile}
      saveProfile={(data) => api.patch("/users/me", data)}
      onSignOut={async () => {
        await signOut();
        setBootState("ANONYMOUS");
      }}
      onPrivacy={() => navigation.getParent()?.navigate("Privacy")}
    />
  );
}

// Stable component references — passed straight through, never redefined per
// render — so `HomeTabs`'s `Tab.Screen`s never see a changed component type.
function HomeTabsContainer() {
  return (
    <HomeTabs
      HomeComponent={HomeTabContainer}
      VehiclesComponent={VehiclesTabContainer}
      ProfileComponent={ProfileTabContainer}
    />
  );
}

function AddVehicleContainer({ navigation, refreshVehicles }: any) {
  return (
    <AddVehicleScreen
      createVehicle={(data) => api.post<Vehicle>("/vehicles", data)}
      onCreated={async (vehicle: Vehicle) => {
        await refreshVehicles();
        navigation.replace("Photos", { vehicle });
      }}
    />
  );
}

function PhotosContainer({ navigation, route, refreshVehicles }: any) {
  const { vehicle } = route.params;
  const goHome = async () => {
    await refreshVehicles();
    navigation.reset({ index: 0, routes: [{ name: "HomeTabsScreen" }] });
  };
  return (
    <VehiclePhotosScreen
      vehicleId={vehicle.id}
      onDone={goHome}
      pickImage={async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return null;
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (result.canceled || result.assets.length === 0) return null;
        return result.assets[0].uri;
      }}
      uploadPhoto={uploadVehiclePhoto}
      patchVehicle={(id, body) => api.patch(`/vehicles/${id}`, body)}
    />
  );
}

function VehicleDetailContainer({ navigation, route, refreshVehicles }: any) {
  const { vehicle } = route.params;
  return (
    <VehicleDetailScreen
      vehicle={vehicle}
      onUpdateOdometer={async (km: number, justification?: string) => {
        await api.post(`/vehicles/${vehicle.id}/odometer`, { km, justification });
        await refreshVehicles();
      }}
      onArchive={(id: string) => api.del(`/vehicles/${id}`)}
      onArchived={async () => {
        await refreshVehicles();
        navigation.goBack();
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

function PrivacyContainer() {
  return (
    <PrivacyScreen
      requestDataExport={() => api.post("/users/me/data-export")}
      requestDeletion={() => api.post("/users/me/deletion-request")}
      onSignedOut={async () => { await signOut(); }}
    />
  );
}

/** READY branch: fetches the vehicle list once, then decides the initial
 * screen — a consented member with zero vehicles is deep-linked straight
 * into AddVehicle (first-run flow). */
function ReadyStack({ setBootState }: { setBootState: (s: BootState) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [firstName, setFirstName] = useState("there");

  const refreshVehicles = useCallback(async () => {
    const list = await api.get<Vehicle[]>("/vehicles");
    setVehicles(list);
    return list;
  }, []);

  useEffect(() => {
    refreshVehicles();
    api.get<{ name: string | null }>("/users/me").then((u) => {
      if (u?.name) setFirstName(u.name.split(" ")[0]);
    }).catch(() => {});
  }, [refreshVehicles]);

  if (vehicles === null) return <Splash />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}
      initialRouteName={vehicles.length === 0 ? "AddVehicle" : "HomeTabsScreen"}>
      <Stack.Screen name="HomeTabsScreen">
        {() => (
          <ReadyContext.Provider value={{ vehicles, refreshVehicles, firstName, setBootState }}>
            <HomeTabsContainer />
          </ReadyContext.Provider>
        )}
      </Stack.Screen>
      <Stack.Screen name="AddVehicle">
        {(props) => <AddVehicleContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="Photos">
        {(props) => <PhotosContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="VehicleDetail">
        {(props) => <VehicleDetailContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="Privacy" component={PrivacyContainer} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const [state, setState] = useState<BootState | "PENDING">("PENDING");

  useEffect(() => {
    bootstrap().then(setState);
  }, []);

  if (state === "PENDING") return <Splash />;

  if (state === "READY") {
    return (
      <NavigationContainer>
        <ReadyStack setBootState={setState} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state === "ANONYMOUS" && (
          <>
            <Stack.Screen name="Onboarding">
              {(props) => <OnboardingContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="PhoneEntry">
              {(props) => <PhoneEntryContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Otp">
              {(props) => <OtpContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Consent">
              {(props) => <ConsentContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
        {state === "NEEDS_CONSENT" && (
          <>
            <Stack.Screen name="Consent">
              {(props) => <ConsentContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
