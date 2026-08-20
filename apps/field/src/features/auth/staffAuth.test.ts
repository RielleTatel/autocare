import { signInStaff } from "./staffAuth";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { getIdToken: async () => "staff-token" } }),
}));
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
