// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { sealSession } from "./lib/auth/session";

process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const req = (path: string, cookie?: string) => {
  const r = new NextRequest(`http://localhost:3000${path}`);
  if (cookie) r.cookies.set("ac_session", cookie);
  return r;
};

describe("middleware", () => {
  it("redirects anonymous /staff to /login", async () => {
    const res = await middleware(req("/staff"));
    expect(res?.headers.get("location")).toContain("/login");
  });
  it("blocks a MEMBER cookie from /admin", async () => {
    const res = await middleware(req("/admin", await sealSession({ uid: "u1", role: "MEMBER" })));
    expect(res?.headers.get("location")).toContain("/login");
  });
  it("lets an ADVISOR into /staff but not /admin", async () => {
    const cookie = await sealSession({ uid: "u2", role: "ADVISOR" });
    expect((await middleware(req("/staff", cookie)))?.headers.get("location")).toBeNull();
    expect((await middleware(req("/admin", cookie)))?.headers.get("location")).toContain("/login");
  });
  it("lets an ADMIN into both", async () => {
    const cookie = await sealSession({ uid: "u3", role: "ADMIN" });
    expect((await middleware(req("/admin", cookie)))?.headers.get("location")).toBeNull();
  });
});
