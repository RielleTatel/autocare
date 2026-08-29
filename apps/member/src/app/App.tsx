import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { RootNavigator } from "./RootNavigator";
import { fontAssets } from "../theme/fonts";
import { theme } from "../theme";

export default function App() {
  // Every screen styles text through `theme.text()`, which names the Barlow /
  // Inter / IBM Plex faces directly. Rendering before they register would show
  // one frame of system-font fallback and reflow, so hold the tree until they
  // resolve. `error` is surfaced as "loaded" on purpose: a missing face should
  // degrade to the system font, never to a permanently blank app.
  const [loaded, error] = useFonts(fontAssets);

  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.chassis }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    // Screens read the status bar / notch insets from here. Without a provider
    // useSafeAreaInsets silently returns zeros, which is why content sat under
    // the clock and the tab bar ignored the home indicator.
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
