// Manual jest mock. Unit tests must never load @react-native-firebase/*
// or @react-native-google-signin/* native modules — session.ts (and
// anything else that imports "./firebaseAuth") gets this stub instead,
// wired up via jest.config.js moduleNameMapper.
export const signInWithEmail = jest.fn(async () => {});
export const registerWithEmail = jest.fn(async () => {});
export const sendPasswordReset = jest.fn(async () => {});
export const signInWithGoogle = jest.fn(async () => {});
export const currentIdToken = jest.fn(async (): Promise<string | null> => null);
export const signOut = jest.fn(async () => {});
