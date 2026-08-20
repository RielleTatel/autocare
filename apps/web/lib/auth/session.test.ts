// @vitest-environment node
import { EncryptJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { openSession, sealSession } from "./session";

const DEFAULT_SECRET = "0123456789abcdef0123456789abcdef";
process.env.SESSION_SECRET = DEFAULT_SECRET;

afterEach(() => {
  process.env.SESSION_SECRET = DEFAULT_SECRET;
});

describe("session cookie", () => {
  it("round-trips uid and role", async () => {
    const cookie = await sealSession({ uid: "u1", role: "ADMIN" });
    expect(await openSession(cookie)).toMatchObject({ uid: "u1", role: "ADMIN" });
  });

  it("returns null for garbage", async () => {
    expect(await openSession("not-a-jwe")).toBeNull();
  });

  it("round-trips with a secret that is NOT exactly 32 chars (base64, 44 chars)", async () => {
    // Mirrors `openssl rand -base64 32` output — 44 chars, not 32 bytes.
    // Regression test: sealSession/openSession must derive a fixed 32-byte
    // key via hashing, not pass the raw secret straight to A256GCM.
    process.env.SESSION_SECRET = "9x2k7qP1zR8mN4vL6cJ0wY3bT5aF7hK9dQ2sU4eG6iA=";
    const cookie = await sealSession({ uid: "u4", role: "MECHANIC" });
    expect(await openSession(cookie)).toMatchObject({ uid: "u4", role: "MECHANIC" });
  });

  it("round-trips with a long passphrase secret (not exactly 32 chars)", async () => {
    process.env.SESSION_SECRET = "this is a much longer dev passphrase used as a session secret";
    const cookie = await sealSession({ uid: "u5", role: "ADVISOR" });
    expect(await openSession(cookie)).toMatchObject({ uid: "u5", role: "ADVISOR" });
  });

  it("returns null for a tampered JWE", async () => {
    const cookie = await sealSession({ uid: "u1", role: "ADMIN" });
    const parts = cookie.split(".");
    // Flip a character in the ciphertext segment (index 3 of a 5-part JWE).
    const ciphertext = parts[3];
    const flippedChar = ciphertext[0] === "A" ? "B" : "A";
    parts[3] = flippedChar + ciphertext.slice(1);
    const tampered = parts.join(".");
    expect(await openSession(tampered)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const key = new TextEncoder().encode(DEFAULT_SECRET);
    const cryptoKey = await crypto.subtle.digest("SHA-256", key);
    const expired = await new EncryptJWT({ uid: "u1", role: "ADMIN" })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 13 * 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .encrypt(new Uint8Array(cryptoKey));
    expect(await openSession(expired)).toBeNull();
  });
});
