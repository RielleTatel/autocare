jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock("../../shared/api", () => ({
  api: { createSession: jest.fn() },
}));

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { classifySession, biometricGate, bootstrap } from "./session";
import { api } from "../../shared/api";
import { currentIdToken } from "./firebaseAuth";

describe("classifySession", () => {
  const now = new Date("2026-08-09T00:00:00Z").getTime();
  it("no token → ANONYMOUS", () => {
    expect(classifySession(null, null, now)).toBe("ANONYMOUS");
  });
  it("token idle over 30 days → ANONYMOUS (FR-015 groundwork, enforced in Task 12)", () => {
    const stale = String(now - 31 * 24 * 3600 * 1000);
    expect(classifySession("tok", stale, now)).toBe("ANONYMOUS");
  });
  it("fresh token → TOKEN_OK", () => {
    expect(classifySession("tok", String(now - 1000), now)).toBe("TOKEN_OK");
  });
  it("expires exactly past the 30-day boundary", () => {
    const THIRTY = 30 * 24 * 3600 * 1000;
    expect(classifySession("tok", String(now - THIRTY), now)).toBe("TOKEN_OK");
    expect(classifySession("tok", String(now - THIRTY - 1), now)).toBe("ANONYMOUS");
  });
});

describe("biometricGate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no hardware → passthrough (returns true) without prompting", async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    await expect(biometricGate()).resolves.toBe(true);
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it("hardware present but nothing enrolled → passthrough (returns true) without prompting", async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    await expect(biometricGate()).resolves.toBe(true);
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it("enrolled + authenticateAsync succeeds → returns true", async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    await expect(biometricGate()).resolves.toBe(true);
  });

  it("enrolled + authenticateAsync fails → returns false", async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });
    await expect(biometricGate()).resolves.toBe(false);
  });
});

describe("bootstrap", () => {
  beforeEach(() => jest.clearAllMocks());

  it("TOKEN_OK but a failed biometric gate returns ANONYMOUS without calling api.createSession", async () => {
    (currentIdToken as jest.Mock).mockResolvedValue("tok");
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(String(Date.now() - 1000)); // recently active → classifySession → TOKEN_OK
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });

    await expect(bootstrap()).resolves.toBe("ANONYMOUS");
    expect(api.createSession).not.toHaveBeenCalled();
  });
});
