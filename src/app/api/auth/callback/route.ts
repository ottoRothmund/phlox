import { NextResponse } from "next/server";

import { SESSION_COOKIE, isSafeRedirect } from "@/lib/auth";

/**
 * Supabase returns the session in the URL fragment, which never reaches the
 * server. This page hands the token back to the server, which sets the
 * httpOnly session cookie, then redirects to the originally requested page.
 */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("next") || "/";
  const next = isSafeRedirect(requested) ? requested : "/";

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Signing in</title></head>
  <body style="font-family:system-ui;padding:2rem">
    <p>Completing sign-in…</p>
    <noscript>JavaScript is required to complete sign-in.</noscript>
    <script>
      (function () {
        var next = ${JSON.stringify(next)};
        var params = new URLSearchParams(window.location.hash.slice(1));
        var token = params.get("access_token");
        if (!token) { window.location.replace(next); return; }
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token }),
        }).then(function () {
          window.location.replace(next);
        });
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
