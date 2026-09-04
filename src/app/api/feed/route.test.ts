import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GITHUB_TOKEN = "";
  process.env.SUPABASE_URL = "";
});

// POST uses the real adapters; keep the network out of the test run.
vi.mock("@/lib/github", () => ({
  searchGitHubRepositories: vi.fn().mockRejectedValue(new Error("offline")),
}));
vi.mock("@/lib/repository-visual", () => ({
  resolveRepositoryVisual: vi.fn().mockResolvedValue(null),
}));

import { buildFeed, POST } from "@/app/api/feed/route";
import { mockRepositories } from "@/lib/mock-data";

describe("feed route", () => {
  it("builds a batch from live lanes with visuals and no repeats", async () => {
    const live = vi.fn().mockResolvedValue(mockRepositories.slice(0, 6));
    const visual = vi.fn().mockResolvedValue({ url: "https://x/y.png", kind: "screenshot" });
    const result = await buildFeed(
      { seed: 11, exclude: [mockRepositories[0].fullName], taste: { topics: { tui: 2 } } },
      { live, visual, reactions: vi.fn().mockResolvedValue({}) },
    );

    expect(live).toHaveBeenCalledTimes(3);
    expect(result.source).toBe("github");
    expect(result.seed).toBe(11);
    const names = result.items.map((item) => item.repository.fullName);
    expect(names).not.toContain(mockRepositories[0].fullName);
    expect(new Set(names).size).toBe(names.length);
    expect(result.items.every((item) => item.visual?.kind === "screenshot")).toBe(true);
  });

  it("falls back to the index when GitHub is down", async () => {
    const result = await buildFeed(
      { seed: 2 },
      {
        live: vi.fn().mockRejectedValue(new Error("rate limited")),
        visual: vi.fn().mockResolvedValue(null),
        reactions: vi.fn().mockResolvedValue({}),
      },
    );
    expect(result.source).toBe("index");
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("ignores garbage bodies", async () => {
    const result = await buildFeed("nonsense", {
      live: vi.fn().mockResolvedValue([mockRepositories[1]]),
      visual: vi.fn().mockResolvedValue(null),
      reactions: vi.fn().mockResolvedValue({}),
    });
    expect(result.items).toHaveLength(1);
  });

  it("rate limits repeated requests from one client", async () => {
    const request = () =>
      new NextRequest("http://localhost/api/feed", {
        method: "POST",
        headers: { "x-real-ip": "192.0.2.50", "Content-Type": "application/json" },
        body: "{}",
      });
    // Global unauthenticated limit is 3/minute, which trips first.
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    const blocked = await POST(request());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});
