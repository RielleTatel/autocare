import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { bootstrap, type BootState } from "../features/auth/session";
import { sendOtp, signInWithGoogle } from "../features/auth/firebaseAuth";
import { api } from "../shared/api";
import { OnboardingScreen } from "../features/auth/OnboardingScreen";
import { PhoneEntryScreen } from "../features/auth/PhoneEntryScreen";
import { OtpScreen } from "../features/auth/OtpScreen";
import { ConsentScreen } from "../features/auth/ConsentScreen";

const Stack = createNativeStackNavigator();

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>AutoCare+</Text>
    </View>
  );
}

/** After Firebase sign-in, ask the API for a session and route by consentRequired. */
async function afterSignIn(navigation: any) {
  const session = await api.createSession();
  if (session.consentRequired) {
    navigation.reset({ index: 0, routes: [{ name: "Consent" }] });
  } else {
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }
}

function OnboardingContainer({ navigation }: any) {
  return <OnboardingScreen onGetStarted={() => navigation.navigate("PhoneEntry")} />;
}

function PhoneEntryContainer({ navigation }: any) {
  return (
    <PhoneEntryScreen
      onSubmit={async (phoneE164) => {
        const confirmation = await sendOtp(phoneE164);
        navigation.navigate("Otp", { phone: phoneE164, confirmation });
      }}
      onGoogle={async () => {
        await signInWithGoogle();
        await afterSignIn(navigation);
      }}
    />
  );
}

function OtpContainer({ navigation, route }: any) {
  const { phone, confirmation } = route.params;
  return (
    <OtpScreen
      phone={phone}
      onConfirm={async (code: string) => {
        await confirmation.confirm(code);
        await afterSignIn(navigation);
      }}
      onResend={async () => {
        const next = await sendOtp(phone);
        navigation.setParams({ confirmation: next });
      }}
    />
  );
}

function ConsentContainer({ navigation }: any) {
  return <ConsentScreen onConsented={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })} />;
}

function HomePlaceholder() {
  // Placeholder until Task 9 hangs the real vehicle stack off READY.
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Home</Text>
    </View>
  );
}

export function RootNavigator() {
  const [state, setState] = useState<BootState | "PENDING">("PENDING");

  useEffect(() => {
    bootstrap().then(setState);
  }, []);

  if (state === "PENDING") return <Splash />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state === "ANONYMOUS" && (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingContainer} />
            <Stack.Screen name="PhoneEntry" component={PhoneEntryContainer} />
            <Stack.Screen name="Otp" component={OtpContainer} />
            <Stack.Screen name="Consent" component={ConsentContainer} />
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
        {state === "NEEDS_CONSENT" && (
          <>
            <Stack.Screen name="Consent" component={ConsentContainer} />
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
        {state === "READY" && <Stack.Screen name="Home" component={HomePlaceholder} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
