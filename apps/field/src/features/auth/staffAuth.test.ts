import { signInStaff, signOutStaff } from "./staffAuth";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { getIdToken: async () => "staff-token" } }),
  signOut: jest.fn().mockResolvedValue(undefined),
}));
import { signOut } from "firebase/auth";
jest.mock("../../shared/api", () => ({ api: { createSession: jest.fn() } }));
import { api } from "../../shared/api";

describe("signInStaff", () => {
  it("stores the token and returns the role for staff", async () => {
    (api.createSession as jest.Mock).mockResolvedValue({ user: { role: "MECHANIC", name: "Ka Tono" }, consentRequired: false });
    const out = await signInStaff("tono@autocare.ph", "pw");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("firebase_id_token", "staff-token");
    expect(out.role).toBe("MECHANIC");
  });
  it("rejects a member account", async () => {
    (api.createSession as jest.Mock).mockResolvedValue({ user: { role: "MEMBER" }, consentRequired: true });
    await expect(signInStaff("m@x.ph", "pw")).rejects.toThrow(/staff/i);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("firebase_id_token");
  });
});

describe("signOutStaff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clears the stored session so the next launch is anonymous", async () => {
    await signOutStaff();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("firebase_id_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("last_active_at");
  });

  // A shared workshop tablet is the normal case. If Firebase sign-out fails the
  // device MUST still forget the token, or the next person inherits the session.
  it("clears local state even when Firebase sign-out fails", async () => {
    (signOut as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    await expect(signOutStaff()).resolves.toBeUndefined();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("firebase_id_token");
  });
});
