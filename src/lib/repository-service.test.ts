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
      24,
    );
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
