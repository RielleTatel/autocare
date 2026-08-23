import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Thin auth-forwarding proxy (NOT domain logic — §7.4a): forwards a staff request to the NestJS
// API attaching the httpOnly ac_session cookie as a Bearer token, which the API's AuthGuard opens
// with the shared SESSION_SECRET. Keeps the session cookie server-side; the client never sees it.
async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const session = cookies().get("ac_session")?.value;
  if (!session) return NextResponse.json({ success: false, error: { code: "AUTH_TOKEN_INVALID", message: "no session" } }, { status: 401 });

  const search = req.nextUrl.search;
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${path.join("/")}${search}`;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";

  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${session}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}

type Ctx = { params: { path: string[] } };
export const GET = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const POST = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const PUT = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const PATCH = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const DELETE = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
