import { NextResponse } from "next/server";

import {
  authConfig,
  authorizeUrl,
  callbackUrl,
  isAuthProvider,
  isSafeRedirect,
} from "@/lib/auth";

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
  // Not `new URL(..., request.url)`: behind a proxy that is the container's
  // internal address, and Supabase would send the user back to localhost.
  const callback = callbackUrl(request);

  return NextResponse.redirect(authorizeUrl(config, provider, callback, next));
}
