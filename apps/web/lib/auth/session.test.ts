// @vitest-environment node
import { describe, expect, it } from "vitest";
import { openSession, sealSession } from "./session";

process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";

describe("session cookie", () => {
  it("round-trips uid and role", async () => {
    const cookie = await sealSession({ uid: "u1", role: "ADMIN" });
    expect(await openSession(cookie)).toMatchObject({ uid: "u1", role: "ADMIN" });
  });
  it("returns null for garbage", async () => {
    expect(await openSession("not-a-jwe")).toBeNull();
  });
});
