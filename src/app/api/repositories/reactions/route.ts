import type { NextRequest } from "next/server";

import { setRepositoryReaction } from "@/lib/phlox-data";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit";
import { getRepository } from "@/lib/repository-service";

const reactionLimit = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function validRepositoryName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 201 &&
    /^[^/\s]+\/[^/\s]+$/.test(value)
  );
}

export async function POST(request: NextRequest) {
  const decision = reactionLimit(clientKey(request));
  if (!decision.allowed) {
    return Response.json(
      { error: "Too many reaction updates. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid reaction payload." }, { status: 400 });
  }

  const { fullName, visitorId, reaction } = body as Record<string, unknown>;
  if (
    !validRepositoryName(fullName) ||
    !validUuid(visitorId) ||
    (reaction !== null && reaction !== "like" && reaction !== "dislike")
  ) {
    return Response.json({ error: "Invalid reaction payload." }, { status: 400 });
  }

  try {
    const [owner, name] = fullName.split("/");
    const repository = await getRepository(owner, name);
    if (!repository) {
      return Response.json(
        { error: "Public repository not found." },
        { status: 404 },
      );
    }
    const result = await setRepositoryReaction({
      fullName,
      visitorId,
      reaction,
    });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Shared reactions are temporarily unavailable." },
      { status: 503 },
    );
  }
}
