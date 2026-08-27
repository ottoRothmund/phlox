import { NextResponse } from "next/server";

import { authConfig, authorizeUrl, isAuthProvider, isSafeRedirect } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isAuthProvider(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  const config = authConfig();
  if (!config) {
    return NextResponse.json({ error: "Sign-in is not configured." }, { status: 503 });
  }

  const requested = new URL(request.url).searchParams.get("next") || "/";
  const next = isSafeRedirect(requested) ? requested : "/";
  const callback = new URL("/api/auth/callback", request.url).toString();

  return NextResponse.redirect(authorizeUrl(config, provider, callback, next));
}
