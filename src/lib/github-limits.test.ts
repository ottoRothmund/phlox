import { afterEach, describe, expect, it } from "vitest";

import {
  GitHubRateLimitError,
  assertGitHubQuota,
  isGitHubRateLimitError,
  rateLimitCooldownSeconds,
  recordGitHubResponse,
  resetGitHubQuotaState,
} from "@/lib/github-limits";

function response(
  status: number,
  headers: Record<string, string>,
): { status: number; headers: Headers; ok: boolean } {
  return {
    status,
    headers: new Headers(headers),
    ok: status >= 200 && status < 300,
  };
}

afterEach(() => {
  resetGitHubQuotaState();
});

describe("recordGitHubResponse", () => {
  it("treats a 403 with no remaining budget as a rate limit", () => {
    const now = 1_000_000;
    const error = recordGitHubResponse(
      "search",
      response(403, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String((now + 45_000) / 1_000),
      }),
      now,
    );

    // GitHub reports an exhausted primary limit as 403, not 429, so a status
    // check alone cannot tell this from a permissions failure.
    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect(error?.retryAfterSeconds).toBe(45);
  });

  it("leaves a 403 with budget remaining alone", () => {
    const error = recordGitHubResponse(
      "search",
      response(403, { "x-ratelimit-remaining": "12" }),
    );

    // A permissions or abuse-detection 403 must not silence live search.
    expect(error).toBeNull();
    expect(rateLimitCooldownSeconds("search")).toBe(0);
  });

  it("honours retry-after on a secondary limit", () => {
    const now = 2_000_000;
    const error = recordGitHubResponse(
      "core",
      response(429, { "retry-after": "17" }),
      now,
    );

    expect(error?.retryAfterSeconds).toBe(17);
    expect(rateLimitCooldownSeconds("core", now)).toBe(17);
  });

  it("blocks the next call when a success spends the last unit", () => {
    const now = 3_000_000;
    const error = recordGitHubResponse(
      "search",
      response(200, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String((now + 30_000) / 1_000),
      }),
      now,
    );

    expect(error).toBeNull();
    expect(rateLimitCooldownSeconds("search", now)).toBe(30);
  });

  it("clears the block once a later response reports budget", () => {
    const now = 4_000_000;
    recordGitHubResponse("search", response(429, { "retry-after": "60" }), now);
    expect(rateLimitCooldownSeconds("search", now)).toBe(60);

    recordGitHubResponse(
      "search",
      response(200, { "x-ratelimit-remaining": "29" }),
      now,
    );
    expect(rateLimitCooldownSeconds("search", now)).toBe(0);
  });

  it("caps an implausible reset time", () => {
    const now = 5_000_000;
    recordGitHubResponse(
      "search",
      response(403, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String((now + 86_400_000) / 1_000),
      }),
      now,
    );

    // A bad clock or a bogus header must not take live search offline for a day.
    expect(rateLimitCooldownSeconds("search", now)).toBe(15 * 60);
  });

  it("falls back to a fixed cooldown with no reset hint", () => {
    const now = 6_000_000;
    const error = recordGitHubResponse(
      "core",
      response(403, { "x-ratelimit-remaining": "0" }),
      now,
    );

    expect(error?.retryAfterSeconds).toBe(60);
  });
  it("ignores a response with no rate-limit headers at all", () => {
    const now = 8_000_000;
    // `headers.get` returns null for a missing header and `Number(null)` is 0,
    // so a naive read treats every header-less response as exhausted.
    const error = recordGitHubResponse("search", response(200, {}), now);

    expect(error).toBeNull();
    expect(rateLimitCooldownSeconds("search", now)).toBe(0);
    expect(() => assertGitHubQuota("search", now)).not.toThrow();
  });

  it("does not clear an existing block on a header-less success", () => {
    const now = 9_000_000;
    recordGitHubResponse("search", response(429, { "retry-after": "30" }), now);
    recordGitHubResponse("search", response(200, {}), now);

    expect(rateLimitCooldownSeconds("search", now)).toBe(30);
  });
});

describe("assertGitHubQuota", () => {
  it("throws while the window is known-spent and stops once it passes", () => {
    const now = 7_000_000;
    recordGitHubResponse("search", response(429, { "retry-after": "20" }), now);

    expect(() => assertGitHubQuota("search", now)).toThrowError(
      GitHubRateLimitError,
    );
    // A different resource has its own budget.
    expect(() => assertGitHubQuota("core", now)).not.toThrow();
    expect(() => assertGitHubQuota("search", now + 21_000)).not.toThrow();
  });

  it("does not throw before anything is recorded", () => {
    expect(() => assertGitHubQuota("search")).not.toThrow();
  });
});

describe("isGitHubRateLimitError", () => {
  it("distinguishes rate limits from ordinary failures", () => {
    expect(isGitHubRateLimitError(new GitHubRateLimitError("search", 5))).toBe(
      true,
    );
    expect(isGitHubRateLimitError(new Error("GitHub search failed"))).toBe(
      false,
    );
  });
});
