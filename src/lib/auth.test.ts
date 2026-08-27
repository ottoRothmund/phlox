import { describe, expect, it } from "vitest";

import {
  authorizeUrl,
  isSafeRedirect,
  parseSessionUser,
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
