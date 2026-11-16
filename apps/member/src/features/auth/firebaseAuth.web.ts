import { getApp, getApps, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";

function auth() {
  const app = getApps().length ? getApp() : initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return getAuth(app);
}
function active() { if (typeof sessionStorage !== "undefined") sessionStorage.setItem("autocare_last_active_at", String(Date.now())); }
export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth(), email, password); active();
}
export async function registerWithEmail(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth(), email, password);
  await sendEmailVerification(credential.user).catch(() => undefined); active();
}
export async function sendPasswordReset(email: string) { await sendPasswordResetEmail(auth(), email); }
export async function signInWithGoogle() { await signInWithPopup(auth(), new GoogleAuthProvider()); active(); }
export async function currentIdToken(): Promise<string | null> {
  const instance = auth(); await instance.authStateReady();
  return instance.currentUser?.getIdToken() ?? null;
}
export async function signOut() {
  try { await firebaseSignOut(auth()); } finally {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("autocare_last_active_at");
  }
}
