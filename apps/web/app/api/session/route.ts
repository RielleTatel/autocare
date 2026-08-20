import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sealSession } from "../../../lib/auth/session";

// Zero domain logic here (Architecture §7.4a): this route only verifies the
// Firebase ID token via the API's /auth/session endpoint and mints the
// sealed session cookie. It never inspects or logs the ID token itself.
export async function POST(req: Request) {
  const { idToken } = await req.json();
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const body = await upstream.json();
  if (!upstream.ok || !body.success) {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
  const { id, role } = body.data.user;
  if (role === "MEMBER" || role === "FLEET_MANAGER") {
    return NextResponse.json({ error: "staff_only" }, { status: 403 });
  }
  cookies().set("ac_session", await sealSession({ uid: id, role }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 3600,
    path: "/",
  });
  return NextResponse.json({ role });
}

export async function DELETE() {
  cookies().delete("ac_session");
  return NextResponse.json({ ok: true });
}
