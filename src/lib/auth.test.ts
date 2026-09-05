import { afterEach, describe, expect, it } from "vitest";

import {
  authorizeUrl,
  callbackUrl,
  isSafeRedirect,
  parseSessionUser,
  publicOrigin,
  supportedProviders,
} from "@/lib/auth";

const config = {
  url: "https://project.supabase.co",
  key: "publishable-key",
};

describe("auth", () => {
  it("supports GitHub and Google only", () => {
    expect(supportedProviders).toEqual(["github", "google"]);
  });

  it("builds a Supabase authorize URL with the callback redirect", () => {
    const url = new URL(
      authorizeUrl(config, "github", "https://phlox.dev/api/auth/callback", "/explore"),
    );

    expect(url.origin + url.pathname).toBe(
      "https://project.supabase.co/auth/v1/authorize",
    );
    expect(url.searchParams.get("provider")).toBe("github");
    const redirect = new URL(url.searchParams.get("redirect_to") || "");
    expect(redirect.pathname).toBe("/api/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/explore");
  });

  it("rejects off-site redirect targets", () => {
    expect(isSafeRedirect("/explore")).toBe(true);
    expect(isSafeRedirect("/repo/astral-sh/uv")).toBe(true);
    expect(isSafeRedirect("https://evil.example/steal")).toBe(false);
    expect(isSafeRedirect("//evil.example")).toBe(false);
    expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
  });

  it("reads a display name and avatar from a Supabase user", () => {
    expect(
      parseSessionUser({
        id: "8f2c1b90-1111-4222-8333-444455556666",
        email: "dev@example.com",
        user_metadata: {
          user_name: "octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        app_metadata: { provider: "github" },
      }),
    ).toEqual({
      id: "8f2c1b90-1111-4222-8333-444455556666",
      name: "octocat",
      email: "dev@example.com",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      provider: "github",
    });
  });

  it("falls back to the email local part when no username is present", () => {
    expect(
      parseSessionUser({
        id: "8f2c1b90-1111-4222-8333-444455556666",
        email: "ada@example.com",
        user_metadata: {},
        app_metadata: { provider: "google" },
      })?.name,
    ).toBe("ada");
  });

  it("returns null for a malformed user payload", () => {
    expect(parseSessionUser(null)).toBeNull();
    expect(parseSessionUser({ email: "no-id@example.com" })).toBeNull();
  });
});

describe("publicOrigin", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  function request(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, { headers });
  }

  it("prefers the configured canonical origin over the request", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://phlox.example";
    // The server listens on an internal port; the browser never sees it.
    expect(publicOrigin(request("http://localhost:3000/api/auth/signin/github"))).toBe(
      "https://phlox.example",
    );
  });

  it("uses forwarded proxy headers when no origin is configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      publicOrigin(
        request("http://localhost:3000/api/auth/signin/github", {
          "x-forwarded-host": "phlox.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://phlox.example");
  });

  it("takes the first entry when a proxy chain appends values", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      publicOrigin(
        request("http://localhost:3000/x", {
          "x-forwarded-host": "phlox.example, internal.fly.dev",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://phlox.example");
  });

  it("assumes https for a forwarded host with no proto header", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      publicOrigin(request("http://localhost:3000/x", { host: "phlox.example" })),
    ).toBe("https://phlox.example");
  });

  it("keeps http for local development", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      publicOrigin(request("http://localhost:3000/x", { host: "localhost:3000" })),
    ).toBe("http://localhost:3000");
  });

  it("ignores a header that is not a plausible host", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    // A junk Host header must not become the OAuth callback origin.
    expect(
      publicOrigin(
        request("http://localhost:3000/x", { "x-forwarded-host": "evil.example/path" }),
      ),
    ).toBe("http://localhost:3000");
  });

  it("survives a malformed NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(
      publicOrigin(request("http://localhost:3000/x", { host: "phlox.example" })),
    ).toBe("https://phlox.example");
  });

  it("builds the OAuth callback on the public origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://phlox.example";
    expect(callbackUrl(new Request("http://localhost:3000/api/auth/signin/github"))).toBe(
      "https://phlox.example/api/auth/callback",
    );
  });
});
