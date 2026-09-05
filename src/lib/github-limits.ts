/**
 * GitHub rate-limit tracking.
 *
 * The GitHub search API allows 30 requests/minute for the whole token, and
 * Phlox uses ONE server-side token for every visitor. So the limit is shared:
 * a burst of traffic exhausts it in seconds and every later request comes back
 * 403 with `x-ratelimit-remaining: 0`. Firing those requests anyway costs a
 * round-trip to api.github.com before we can fall back, which turns a fast
 * degraded page into a slow one.
 *
 * This module remembers the reset time reported by GitHub and lets callers
 * skip the request while we know it would fail. It is per-instance state, like
 * `rate-limit.ts`: on a multi-instance host each instance learns separately,
 * which is fine because each one gets its own 403 once and then backs off.
 */

export type GitHubResource = "core" | "search";

export class GitHubRateLimitError extends Error {
  readonly resource: GitHubResource;
  /** Seconds until the limit resets, floored at 1. */
  readonly retryAfterSeconds: number;

  constructor(resource: GitHubResource, retryAfterSeconds: number) {
    super(
      `GitHub ${resource} rate limit exhausted; retry in ${retryAfterSeconds}s`,
    );
    this.name = "GitHubRateLimitError";
    this.resource = resource;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isGitHubRateLimitError(
  error: unknown,
): error is GitHubRateLimitError {
  return error instanceof GitHubRateLimitError;
}

const blockedUntil = new Map<GitHubResource, number>();

/** Milliseconds we keep backing off when GitHub gives us no reset hint. */
const fallbackCooldownMs = 60_000;
/** Never trust an absurd reset time; GitHub windows are minutes, not hours. */
const maxCooldownMs = 15 * 60_000;

/**
 * Seconds remaining on a known block, or 0 when requests are allowed.
 * Exported so callers can decide between "skip the call" and "call anyway".
 */
export function rateLimitCooldownSeconds(
  resource: GitHubResource,
  now = Date.now(),
): number {
  const until = blockedUntil.get(resource);
  if (until === undefined) return 0;
  if (now >= until) {
    blockedUntil.delete(resource);
    return 0;
  }
  return Math.max(1, Math.ceil((until - now) / 1_000));
}

/** Throws when we already know this resource is rate limited. */
export function assertGitHubQuota(
  resource: GitHubResource,
  now = Date.now(),
): void {
  const cooldown = rateLimitCooldownSeconds(resource, now);
  if (cooldown > 0) throw new GitHubRateLimitError(resource, cooldown);
}

function parseResetMs(headers: Headers, now: number): number {
  // `retry-after` is seconds (secondary limits); `x-ratelimit-reset` is a unix
  // second timestamp (primary limits). Prefer whichever GitHub actually sent.
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return now + retryAfter * 1_000;
  }

  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    const resetMs = reset * 1_000;
    if (resetMs > now) return resetMs;
  }

  return now + fallbackCooldownMs;
}

/**
 * Records what a response tells us about the budget.
 *
 * Returns a GitHubRateLimitError when the response IS a rate-limit rejection,
 * so the caller can throw it, and null otherwise. GitHub signals an exhausted
 * primary limit as 403 (not 429) with `x-ratelimit-remaining: 0`, so a bare
 * status check cannot tell a rate limit from a permissions failure.
 */
function remainingBudget(headers: Headers): number | null {
  // `headers.get` returns null when absent, and `Number(null)` is 0 — which
  // would read as "exhausted" on any response that carries no rate-limit
  // headers at all (including every mocked one in the tests).
  const raw = headers.get("x-ratelimit-remaining");
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function recordGitHubResponse(
  resource: GitHubResource,
  response: { status: number; headers: Headers },
  now = Date.now(),
): GitHubRateLimitError | null {
  const remaining = remainingBudget(response.headers);
  const exhausted = remaining !== null && remaining <= 0;
  const rejected = response.status === 429 || response.status === 403;

  if (rejected && (exhausted || response.headers.has("retry-after"))) {
    const until = Math.min(parseResetMs(response.headers, now), now + maxCooldownMs);
    blockedUntil.set(resource, until);
    return new GitHubRateLimitError(
      resource,
      Math.max(1, Math.ceil((until - now) / 1_000)),
    );
  }

  if (response.status >= 200 && response.status < 300) {
    if (exhausted) {
      // The request that spent the last unit still succeeded. Block the next.
      blockedUntil.set(
        resource,
        Math.min(parseResetMs(response.headers, now), now + maxCooldownMs),
      );
    } else if (remaining !== null) {
      blockedUntil.delete(resource);
    }
  }

  return null;
}

/** Test seam. */
export function resetGitHubQuotaState(): void {
  blockedUntil.clear();
}
