import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

async function persistToken() {
  const token = await auth().currentUser?.getIdToken();
  if (token) {
    await SecureStore.setItemAsync("firebase_id_token", token);
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
  }
}

export async function signInWithEmail(email: string, password: string) {
  await auth().signInWithEmailAndPassword(email, password);
  await persistToken();
}

export async function registerWithEmail(email: string, password: string) {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  // Send-only verification (Architecture §7.3a): email the link, don't block the
  // first session on it. Best-effort — a failed send must not fail registration.
  await cred.user.sendEmailVerification().catch(() => {});
  await persistToken();
}

export async function sendPasswordReset(email: string) {
  await auth().sendPasswordResetEmail(email);
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { data } = await GoogleSignin.signIn();
  const cred = auth.GoogleAuthProvider.credential(data?.idToken ?? null);
  await auth().signInWithCredential(cred);
  await persistToken();
}

export async function currentIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (user) { const t = await user.getIdToken(); await SecureStore.setItemAsync("firebase_id_token", t); return t; }
  return SecureStore.getItemAsync("firebase_id_token");
}

export async function signOut() {
  await auth().signOut().catch(() => {});
  await SecureStore.deleteItemAsync("firebase_id_token");
  await SecureStore.deleteItemAsync("last_active_at");
}
