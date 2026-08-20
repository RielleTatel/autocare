import { NextResponse, type NextRequest } from "next/server";
import { openSession } from "./lib/auth/session";

const GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/staff", roles: ["ADVISOR", "MECHANIC", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const gate = GATES.find((g) => req.nextUrl.pathname.startsWith(g.prefix));
  if (!gate) return NextResponse.next();
  const cookie = req.cookies.get("ac_session")?.value;
  const session = cookie ? await openSession(cookie) : null;
  if (!session || !gate.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/staff/:path*", "/admin/:path*"] };
