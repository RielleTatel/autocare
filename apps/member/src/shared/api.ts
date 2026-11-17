import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@autocare/api-client";
import { withRateLimitDiagnostics } from "./apiDiagnostics";

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
  fetchImpl: __DEV__ ? withRateLimitDiagnostics(fetch) : undefined,
  getToken: () => SecureStore.getItemAsync("firebase_id_token"),
});
