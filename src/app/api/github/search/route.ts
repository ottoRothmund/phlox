import type { NextRequest } from "next/server";

import { createFixedWindowRateLimiter } from "@/lib/rate-limit";
import { searchRepositories } from "@/lib/repository-service";
import {
  MAX_SEARCH_QUERY_LENGTH,
  isRepositorySort,
  parseAgeWindow,
  parseStarFloor,
} from "@/lib/repositories";

const windowMs = 60_000;
const globalLimit = createFixedWindowRateLimiter({
  limit: process.env.GITHUB_TOKEN ? 24 : 8,
  windowMs,
  maxKeys: 1,
});
const clientLimit = createFixedWindowRateLimiter({
  limit: 6,
  windowMs,
});

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function rateLimited(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many search requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const requestedSort = request.nextUrl.searchParams.get("sort");
  const sort = isRepositorySort(requestedSort) ? requestedSort : "relevance";
  const filters = {
    minStars: parseStarFloor(request.nextUrl.searchParams.get("stars") ?? undefined),
    maxAgeDays: parseAgeWindow(request.nextUrl.searchParams.get("age") ?? undefined),
  };

  if (!query) {
    return Response.json(
      { error: "A non-empty q parameter is required." },
      { status: 400 },
    );
  }

  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    return Response.json(
      { error: `q must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const clientDecision = clientLimit(clientKey(request));
  if (!clientDecision.allowed) {
    return rateLimited(clientDecision.retryAfterSeconds);
  }

  const globalDecision = globalLimit("github-search");
  if (!globalDecision.allowed) {
    return rateLimited(globalDecision.retryAfterSeconds);
  }

  const result = await searchRepositories({ query, sort, filters, preferLive: true });
  return Response.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
