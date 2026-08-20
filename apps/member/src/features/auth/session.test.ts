import { classifySession } from "./session";

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
});
