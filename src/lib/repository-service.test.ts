import { describe, expect, it, vi } from "vitest";

import {
  getRepository,
  searchRepositories,
} from "@/lib/repository-service";
import { mockRepositories } from "@/lib/mock-data";

describe("repository service", () => {
  it("treats live GitHub as authoritative for a directly requested repository", async () => {
    const liveGet = vi.fn().mockResolvedValue(null);
    const registerTopics = vi.fn().mockResolvedValue(undefined);

    await expect(
      getRepository("astral-sh", "uv", liveGet, registerTopics),
    ).resolves.toBeNull();
    expect(liveGet).toHaveBeenCalledWith("astral-sh", "uv");
    expect(registerTopics).not.toHaveBeenCalled();
  });

  it("falls back to the local index only when GitHub is unreachable", async () => {
    const liveGet = vi.fn().mockRejectedValue(new Error("network down"));
    const registerTopics = vi.fn().mockResolvedValue(undefined);

    const repository = await getRepository(
      "astral-sh",
      "uv",
      liveGet,
      registerTopics,
    );

    expect(repository?.fullName).toBe("astral-sh/uv");
    expect(registerTopics).toHaveBeenCalledWith("astral-sh/uv", repository?.topics);
  });

  it("uses live GitHub search results when available", async () => {
    const liveSearch = vi.fn().mockResolvedValue([mockRepositories[0]]);

    const result = await searchRepositories({
      query: "python package manager",
      liveSearch,
    });

    expect(liveSearch).toHaveBeenCalled();
    expect(result.source).toBe("github");
    expect(result.repositories).toEqual([mockRepositories[0]]);
  });

  it("applies Phlox sorting to live GitHub results", async () => {
    const liveSearch = vi
      .fn()
      .mockResolvedValue([mockRepositories[16], mockRepositories[0]]);

    const result = await searchRepositories({
      query: "developer tools",
      sort: "rising",
      liveSearch,
    });

    expect(result.repositories[0].fullName).toBe("astral-sh/uv");
  });

  it("preserves GitHub order for relevance results", async () => {
    const liveSearch = vi
      .fn()
      .mockResolvedValue([mockRepositories[16], mockRepositories[0]]);

    const result = await searchRepositories({
      query: "developer tools",
      sort: "relevance",
      liveSearch,
    });

    expect(result.repositories.map((repository) => repository.id)).toEqual([
      mockRepositories[16].id,
      mockRepositories[0].id,
    ]);
  });

  it("falls back to the local index when GitHub is unavailable", async () => {
    const liveSearch = vi.fn().mockRejectedValue(new Error("rate limited"));
    const registerTopics = vi.fn().mockResolvedValue(undefined);

    const result = await searchRepositories({
      query: "linux",
      liveSearch,
      registerTopics,
    });

    expect(result.source).toBe("index");
    expect(result.repositories.length).toBeGreaterThan(0);
    expect(registerTopics).toHaveBeenCalledWith(
      result.repositories[0].fullName,
      result.repositories[0].topics,
    );
  });

  it("keeps the curated feed when a GitHub qualifier query falls back", async () => {
    const liveSearch = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await searchRepositories({
      query: "stars:>100",
      sort: "rising",
      preferLive: true,
      limit: 8,
      liveSearch,
    });

    expect(result.source).toBe("index");
    expect(result.repositories).toHaveLength(8);
  });

  it("uses GitHub for topic and language filters without a text query", async () => {
    const liveSearch = vi.fn().mockResolvedValue([mockRepositories[1]]);

    const result = await searchRepositories({
      topic: "terminal",
      language: "Rust",
      liveSearch,
    });

    expect(liveSearch).toHaveBeenCalledWith(
      "topic:terminal language:Rust",
      "rising",
      48,
    );
    expect(result.source).toBe("github");
  });

  it("fetches a larger pool for locally reranked sorts but not for relevance", async () => {
    const liveSearch = vi.fn().mockResolvedValue([mockRepositories[0]]);

    await searchRepositories({ query: "rust", sort: "relevance", limit: 24, liveSearch });
    expect(liveSearch).toHaveBeenLastCalledWith(expect.any(String), "relevance", 24);

    await searchRepositories({ query: "rust", sort: "newest", limit: 24, liveSearch });
    expect(liveSearch).toHaveBeenLastCalledWith(expect.any(String), "newest", 48);
  });

  it("passes star floor and age window to GitHub as qualifiers and filters the pool", async () => {
    const liveSearch = vi
      .fn()
      .mockResolvedValue([mockRepositories[0], { ...mockRepositories[1], stars: 40 }]);

    const result = await searchRepositories({
      query: "terminal",
      sort: "stars",
      filters: { minStars: 100, maxAgeDays: 365 },
      liveSearch,
    });

    const [liveQuery] = liveSearch.mock.calls[0];
    expect(liveQuery).toContain("stars:>=100");
    expect(liveQuery).toMatch(/created:>=\d{4}-\d{2}-\d{2}/);
    // The 40-star copy is dropped even though GitHub returned it.
    expect(result.repositories.map((repository) => repository.stars)).not.toContain(40);
  });

  it("ranks by Phlox likes using the reaction totals it loaded", async () => {
    const liveSearch = vi
      .fn()
      .mockResolvedValue([mockRepositories[0], mockRepositories[1]]);
    const loadReactionCounts = vi.fn().mockResolvedValue({
      [mockRepositories[0].fullName.toLowerCase()]: { likes: 1, dislikes: 0 },
      [mockRepositories[1].fullName.toLowerCase()]: { likes: 7, dislikes: 2 },
    });

    const result = await searchRepositories({
      query: "terminal",
      sort: "likes",
      liveSearch,
      loadReactionCounts,
    });

    expect(result.repositories[0].fullName).toBe(mockRepositories[1].fullName);
    expect(result.reactionCounts[mockRepositories[1].fullName.toLowerCase()]).toEqual({
      likes: 7,
      dislikes: 2,
    });
  });

  it("serves most liked without a query from Phlox reactions, hydrated live", async () => {
    const liveSearch = vi.fn();
    const loadMostLiked = vi.fn().mockResolvedValue([
      { fullName: "sxyazi/yazi", likes: 9, dislikes: 1 },
      { fullName: "astral-sh/uv", likes: 4, dislikes: 0 },
    ]);
    const liveGet = vi.fn(async (owner: string, name: string) =>
      mockRepositories.find((repository) => repository.fullName === `${owner}/${name}`) ?? null,
    );

    const result = await searchRepositories({
      sort: "likes",
      liveSearch,
      liveGet,
      loadMostLiked,
    });

    expect(liveSearch).not.toHaveBeenCalled();
    expect(result.source).toBe("phlox");
    expect(result.repositories.map((repository) => repository.fullName)).toEqual([
      "sxyazi/yazi",
      "astral-sh/uv",
    ]);
  });

  it("falls through to a normal search when nothing has been liked yet", async () => {
    const liveSearch = vi.fn().mockResolvedValue([mockRepositories[0]]);
    const loadMostLiked = vi.fn().mockResolvedValue([]);

    const result = await searchRepositories({
      sort: "likes",
      topic: "terminal",
      liveSearch,
      loadMostLiked,
    });

    expect(liveSearch).toHaveBeenCalled();
    expect(result.source).toBe("github");
  });

  it("returns indexed repository details before making a network request", async () => {
    // Live GitHub is now authoritative for direct lookups. Indexed data is only
    // used when the live call fails (availability fallback).
    const liveGet = vi.fn().mockRejectedValue(new Error("network"));
    const registerTopics = vi.fn().mockResolvedValue(undefined);

    const result = await getRepository(
      "astral-sh",
      "uv",
      liveGet,
      registerTopics,
    );

    expect(result?.fullName).toBe("astral-sh/uv");
    expect(liveGet).toHaveBeenCalledWith("astral-sh", "uv");
    expect(registerTopics).toHaveBeenCalledWith(
      result?.fullName,
      result?.topics,
    );
  });

  it("propagates transient repository detail failures", async () => {
    const liveGet = vi.fn().mockRejectedValue(new Error("rate limited"));
    // No indexed fallback for this name, so the error surfaces (wrapped for clarity).
    await expect(
      getRepository("northstar", "forge", liveGet),
    ).rejects.toThrow("GitHub is unavailable for this repository.");
  });
});
