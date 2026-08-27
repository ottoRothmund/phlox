import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GITHUB_TOKEN = "";
});

vi.mock("@/lib/repository-service", () => ({
  searchRepositories: vi.fn().mockResolvedValue({
    repositories: [],
    source: "index",
  }),
}));

import { GET } from "@/app/api/github/search/route";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/repositories";

describe("GitHub search route", () => {
  it("rejects queries that exceed the public input limit", async () => {
    const query = "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    const request = new NextRequest(
      `http://localhost/api/github/search?q=${query}`,
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `q must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.`,
    });
  });

  it("rate limits repeated requests from the same client", async () => {
    const request = () =>
      new NextRequest("http://localhost/api/github/search?q=terminal", {
        headers: { "x-real-ip": "192.0.2.10" },
      });

    for (let index = 0; index < 6; index += 1) {
      expect((await GET(request())).status).toBe(200);
    }
    const blocked = await GET(request());

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);

    const otherClient = () =>
      new NextRequest("http://localhost/api/github/search?q=terminal", {
        headers: { "x-real-ip": "192.0.2.11" },
      });
    expect((await GET(otherClient())).status).toBe(200);
    expect((await GET(otherClient())).status).toBe(200);
  });
});
