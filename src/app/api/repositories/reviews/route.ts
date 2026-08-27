import type { NextRequest } from "next/server";

import { createRepositoryReview } from "@/lib/phlox-data";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit";
import { getRepository } from "@/lib/repository-service";

const reviewLimit = createFixedWindowRateLimiter({
  limit: 10,
  windowMs: 10 * 60_000,
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

export async function POST(request: NextRequest) {
  const decision = reviewLimit(clientKey(request));
  if (!decision.allowed) {
    return Response.json(
      { error: "Too many entries. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Invalid review payload." }, { status: 400 });
  }

  const { fullName, visitorId, displayName, kind, body } = payload as Record<
    string,
    unknown
  >;
  if (
    typeof fullName !== "string" ||
    !/^[^/\s]+\/[^/\s]+$/.test(fullName) ||
    fullName.length > 201 ||
    !validUuid(visitorId) ||
    typeof displayName !== "string" ||
    displayName.trim().length < 2 ||
    displayName.trim().length > 40 ||
    (kind !== "comment" && kind !== "review") ||
    typeof body !== "string" ||
    body.trim().length < 2 ||
    body.trim().length > 2000
  ) {
    return Response.json({ error: "Invalid review payload." }, { status: 400 });
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
    const review = await createRepositoryReview({
      fullName,
      visitorId,
      displayName,
      kind,
      body,
    });
    return Response.json(review, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Comments and reviews are temporarily unavailable." },
      { status: 503 },
    );
  }
}
