import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@autocare/api-client";

/** Exported so on-device caches can be namespaced by backend. Pointing the app
 *  at a different API (local Docker vs hosted) means different row ids for the
 *  same logical data, so a cache shared across backends serves ids the current
 *  server has never heard of. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => SecureStore.getItemAsync("firebase_id_token"),
});
