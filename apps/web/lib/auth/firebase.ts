import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Lazily initialized so importing this module (e.g. transitively, via the
// login page component in tests) never eagerly talks to Firebase.
function auth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

/**
 * Signs a staff member in with Firebase and returns their ID token.
 * The token is held in memory only — the caller must pass it straight to
 * the /api/session route handler and never persist it (no localStorage).
 */
export async function signInStaff(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(auth(), email, password);
  return credential.user.getIdToken();
}
