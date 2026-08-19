import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const protectedPath = req.nextUrl.pathname.startsWith("/staff") || req.nextUrl.pathname.startsWith("/admin");
  if (protectedPath && !req.cookies.get("ac_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/staff/:path*", "/admin/:path*"] };
