import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";

if (!getApps().length) {
  initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

export async function signInStaff(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getAuth(), email, password);
  await SecureStore.setItemAsync("firebase_id_token", await cred.user.getIdToken());
  const session = await api.createSession();
  if (!STAFF_ROLES.has(session.user.role)) {
    await SecureStore.deleteItemAsync("firebase_id_token");
    throw new Error("This app is for AutoCare+ staff.");
  }
  await SecureStore.setItemAsync("last_active_at", String(Date.now()));
  return { id: session.user.id, role: session.user.role, name: session.user.name };
}

/**
 * Sign out and forget the device session.
 *
 * The Firebase call is best-effort: a field tablet is often on a thin signal,
 * and a failed round-trip must never leave the token on a shared device for the
 * next person to inherit. Local state is cleared either way.
 */
export async function signOutStaff(): Promise<void> {
  try {
    await signOut(getAuth());
  } catch {
    // Deliberately swallowed — see above.
  }
  await SecureStore.deleteItemAsync("firebase_id_token");
  await SecureStore.deleteItemAsync("last_active_at");
}
