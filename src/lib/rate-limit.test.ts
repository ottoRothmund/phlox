import { describe, expect, it } from "vitest";

import { createFixedWindowRateLimiter } from "@/lib/rate-limit";

describe("fixed-window rate limiter", () => {
  it("rejects requests over the limit until the window resets", () => {
    const allow = createFixedWindowRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(allow("client", 1_000).allowed).toBe(true);
    expect(allow("client", 1_100).allowed).toBe(true);
    expect(allow("client", 1_200)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(allow("client", 2_001).allowed).toBe(true);
  });

  it("tracks clients independently", () => {
    const allow = createFixedWindowRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(allow("first", 1_000).allowed).toBe(true);
    expect(allow("first", 1_100).allowed).toBe(false);
    expect(allow("second", 1_100).allowed).toBe(true);
  });
});
