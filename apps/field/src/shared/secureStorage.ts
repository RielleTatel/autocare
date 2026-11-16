import { Platform } from "react-native";
import * as NativeSecureStore from "expo-secure-store";

const prefix = `autocare-field:${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"}:`;
/** Browser preview uses its origin's persistent storage; native keeps Keychain/Keystore. */
export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS !== "web") return NativeSecureStore.getItemAsync(key);
  return globalThis.localStorage?.getItem(prefix + key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS !== "web") return NativeSecureStore.setItemAsync(key, value);
  globalThis.localStorage.setItem(prefix + key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS !== "web") return NativeSecureStore.deleteItemAsync(key);
  globalThis.localStorage?.removeItem(prefix + key);
}
