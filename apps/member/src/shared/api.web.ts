import { createApiClient } from "@autocare/api-client";
import { currentIdToken } from "../features/auth/firebaseAuth.web";

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
  getToken: currentIdToken,
});
