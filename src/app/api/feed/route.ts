import type { NextRequest } from "next/server";

import {
  assembleFeedBatch,
  FEED_BATCH_SIZE,
  MAX_EXCLUDE,
  planFeedQueries,
  sanitizeWeights,
  type FeedItem,
  type FeedQueryPlan,
  type FeedTaste,
} from "@/lib/feed";
import { searchGitHubRepositories } from "@/lib/github";
import { queryMockRepositories } from "@/lib/mock-data";
import { getRepositoryReactionCounts, type ReactionCounts } from "@/lib/phlox-data";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit";
import { sortRepositories, type Repository } from "@/lib/repositories";
import { resolveRepositoryVisual } from "@/lib/repository-visual";

export interface FeedResponse {
  items: FeedItem[];
  seed: number;
  source: "github" | "index";
  reactionCounts: Record<string, ReactionCounts>;
}

const LANE_LIMIT = 20;
const windowMs = 60_000;
// Each batch costs three GitHub search calls. Authenticated search allows 30
// per minute, so eight batches keeps a margin for the rest of the site.
const globalLimit = createFixedWindowRateLimiter({
  limit: process.env.GITHUB_TOKEN ? 8 : 3,
  windowMs,
  maxKeys: 1,
});
const clientLimit = createFixedWindowRateLimiter({ limit: 6, windowMs });

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function rateLimited(retryAfterSeconds: number) {
  return Response.json(
    { error: "The feed is busy. Try again shortly." },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) },
    },
  );
}

async function noopRegisterTopics(): Promise<void> {}

async function runLane(
  plan: FeedQueryPlan,
  live: typeof searchGitHubRepositories,
): Promise<{ plan: FeedQueryPlan; repositories: Repository[]; live: boolean }> {
  try {
    const repositories = await live(plan.query, plan.sort, LANE_LIMIT, noopRegisterTopics);
    if (repositories.length > 0) {
      return { plan, repositories: sortRepositories(repositories, plan.sort), live: true };
    }
  } catch {
    // Rate limits and outages fall through to the curated index.
  }
  return { plan, repositories: queryMockRepositories({ sort: plan.sort }), live: false };
}

function parseBody(value: unknown): {
  taste: FeedTaste;
  exclude: string[];
  seed: number;
} {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const tasteRecord =
    typeof record.taste === "object" && record.taste !== null
      ? (record.taste as Record<string, unknown>)
      : {};
  const exclude = Array.isArray(record.exclude)
    ? record.exclude
        .filter((item): item is string => typeof item === "string" && item.length <= 201)
        .slice(-MAX_EXCLUDE)
    : [];
  const seed =
    typeof record.seed === "number" && Number.isFinite(record.seed)
      ? Math.floor(record.seed) >>> 0
      : (Math.random() * 0xffffffff) >>> 0;
  return {
    taste: {
      topics: sanitizeWeights(tasteRecord.topics),
      languages: sanitizeWeights(tasteRecord.languages),
    },
    exclude,
    seed,
  };
}

export async function buildFeed(
  body: unknown,
  deps: {
    live?: typeof searchGitHubRepositories;
    visual?: typeof resolveRepositoryVisual;
    reactions?: typeof getRepositoryReactionCounts;
  } = {},
): Promise<FeedResponse> {
  const live = deps.live ?? searchGitHubRepositories;
  const visual = deps.visual ?? resolveRepositoryVisual;
  const reactions = deps.reactions ?? getRepositoryReactionCounts;
  const { taste, exclude, seed } = parseBody(body);

  const lanes = await Promise.all(
    planFeedQueries(taste, seed).map((plan) => runLane(plan, live)),
  );
  const items = assembleFeedBatch(lanes, exclude, seed, FEED_BATCH_SIZE);

  const [visuals, reactionCounts] = await Promise.all([
    Promise.all(
      items.map((item) =>
        visual(item.repository.owner, item.repository.name).catch(() => null),
      ),
    ),
    reactions(items.map((item) => item.repository.fullName)).catch(
      (): Record<string, ReactionCounts> => ({}),
    ),
  ]);

  return {
    items: items.map((item, index) => ({ ...item, visual: visuals[index] })),
    seed,
    source: lanes.some((lane) => lane.live) ? "github" : "index",
    reactionCounts,
  };
}

export async function POST(request: NextRequest) {
  const clientDecision = clientLimit(clientKey(request));
  if (!clientDecision.allowed) return rateLimited(clientDecision.retryAfterSeconds);
  const globalDecision = globalLimit("feed");
  if (!globalDecision.allowed) return rateLimited(globalDecision.retryAfterSeconds);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const result = await buildFeed(body);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
