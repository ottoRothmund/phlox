import { NextResponse } from "next/server";

import { SESSION_COOKIE, authConfig, fetchSessionUser } from "@/lib/auth";

const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const config = authConfig();
  if (!config) {
    return NextResponse.json({ error: "Sign-in is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const accessToken = (body as { accessToken?: unknown }).accessToken;
  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  // The token is only trusted after Supabase confirms it resolves to a user.
  const user = await fetchSessionUser(config, accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
