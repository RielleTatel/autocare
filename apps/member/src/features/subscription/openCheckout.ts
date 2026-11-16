import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
export function openCheckout(url: string) {
  return WebBrowser.openAuthSessionAsync(url, Linking.createURL("payment-result"));
}
