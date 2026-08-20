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

export async function sendOtp(phoneE164: string) {
  const confirmation = await auth().signInWithPhoneNumber(phoneE164);
  return {
    confirm: async (code: string) => { await confirmation.confirm(code); await persistToken(); },
  };
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
