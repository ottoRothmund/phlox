import { describe, expect, it } from "vitest";

import {
  applyRepositoryFilters,
  filterRepositories,
  findRelatedRepositories,
  isRepositorySort,
  parseAgeWindow,
  parseStarFloor,
  sortRepositories,
  type Repository,
} from "@/lib/repositories";

const repositories: Repository[] = [
  {
    id: 1,
    owner: "voidtools",
    name: "orbit",
    fullName: "voidtools/orbit",
    description: "A tiny terminal-first package explorer",
    stars: 840,
    forks: 31,
    openIssues: 8,
    watchers: 19,
    language: "Rust",
    license: "MIT",
    topics: ["cli", "developer-tools"],
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-08-22T00:00:00Z",
    pushedAt: "2026-08-22T00:00:00Z",
    starDelta7d: 316,
    contributorCount: 12,
    isVerified: false,
  },
  {
    id: 2,
    owner: "debian",
    name: "debian",
    fullName: "debian/debian",
    description: "The universal operating system",
    stars: 12400,
    forks: 2200,
    openIssues: 104,
    watchers: 950,
    language: "Shell",
    license: "GPL-2.0",
    topics: ["linux", "distribution"],
    createdAt: "2014-01-01T00:00:00Z",
    updatedAt: "2026-08-23T00:00:00Z",
    pushedAt: "2026-08-23T00:00:00Z",
    starDelta7d: 74,
    contributorCount: 812,
    isVerified: true,
  },
];

describe("repository discovery", () => {
  it("matches names, descriptions, languages, and topics without case sensitivity", () => {
    expect(filterRepositories(repositories, "RUST")).toEqual([repositories[0]]);
    expect(filterRepositories(repositories, "distribution")).toEqual([
      repositories[1],
    ]);
    expect(filterRepositories(repositories, "terminal package")).toEqual([
      repositories[0],
    ]);
  });

  it("sorts rising repositories by recent growth relative to current size", () => {
    expect(sortRepositories(repositories, "rising")[0].fullName).toBe(
      "voidtools/orbit",
    );
  });

  it("demotes mega repositories in rising even with huge absolute growth", () => {
    const giant: Repository = {
      ...repositories[1],
      id: 10,
      owner: "freeCodeCamp",
      name: "freeCodeCamp",
      fullName: "freeCodeCamp/freeCodeCamp",
      stars: 420_000,
      starDelta7d: 1_500,
    };
    const smallFast: Repository = {
      ...repositories[0],
      id: 11,
      owner: "tiny",
      name: "comet",
      fullName: "tiny/comet",
      stars: 2_400,
      starDelta7d: 400,
    };

    const ranked = sortRepositories([giant, smallFast], "rising");
    expect(ranked[0].fullName).toBe("tiny/comet");
  });

  it("keeps noise repositories with a handful of stars from topping rising", () => {
    const noise: Repository = {
      ...repositories[0],
      id: 12,
      owner: "someone",
      name: "new-thing",
      fullName: "someone/new-thing",
      stars: 9,
      starDelta7d: 8,
    };

    const ranked = sortRepositories([noise, repositories[0]], "rising");
    expect(ranked[0].fullName).toBe("voidtools/orbit");
  });

  it("sorts popular repositories by star count", () => {
    expect(sortRepositories(repositories, "stars")[0].fullName).toBe(
      "debian/debian",
    );
  });

  it("sorts by forks, creation date, and last push", () => {
    expect(sortRepositories(repositories, "forks")[0].fullName).toBe("debian/debian");
    expect(sortRepositories(repositories, "newest")[0].fullName).toBe("voidtools/orbit");
    expect(sortRepositories(repositories, "updated")[0].fullName).toBe("debian/debian");
  });

  it("sorts by likes, then net score, then stars, and tolerates missing counts", () => {
    const third: Repository = {
      ...repositories[0],
      id: 3,
      fullName: "third/thing",
      stars: 5,
    };
    const ranked = sortRepositories([...repositories, third], "likes", {
      reactionCounts: {
        "voidtools/orbit": { likes: 3, dislikes: 3 },
        "third/thing": { likes: 3, dislikes: 0 },
        // debian/debian has no row at all
      },
    });
    expect(ranked.map((repository) => repository.fullName)).toEqual([
      "third/thing",
      "voidtools/orbit",
      "debian/debian",
    ]);
  });

  it("looks up reaction counts case-insensitively", () => {
    const mixedCase: Repository = { ...repositories[1], fullName: "Debian/Debian" };
    const ranked = sortRepositories([repositories[0], mixedCase], "likes", {
      reactionCounts: { "debian/debian": { likes: 2, dislikes: 0 } },
    });
    expect(ranked[0].fullName).toBe("Debian/Debian");
  });

  it("filters by star floor and creation window", () => {
    const now = Date.parse("2026-09-01T00:00:00Z");
    expect(
      applyRepositoryFilters(repositories, { minStars: 1_000 }, now).map((r) => r.fullName),
    ).toEqual(["debian/debian"]);
    expect(
      applyRepositoryFilters(repositories, { maxAgeDays: 365 }, now).map((r) => r.fullName),
    ).toEqual(["voidtools/orbit"]);
    expect(applyRepositoryFilters(repositories, {}, now)).toBe(repositories);
  });

  it("only accepts the star floors and age windows the interface offers", () => {
    expect(parseStarFloor("1000")).toBe(1_000);
    expect(parseStarFloor("999")).toBe(0);
    expect(parseStarFloor(undefined)).toBe(0);
    expect(parseAgeWindow("30")).toBe(30);
    expect(parseAgeWindow("31")).toBe(0);
    expect(isRepositorySort("likes")).toBe(true);
    expect(isRepositorySort("bogus")).toBe(false);
  });


  it("finds related repositories by shared topics and language", () => {
    const rustAlternative = {
      ...repositories[0],
      id: 3,
      owner: "northstar",
      name: "trail",
      fullName: "northstar/trail",
      topics: ["cli", "rust"],
    };
    const related = findRelatedRepositories(
      repositories[0],
      [...repositories, rustAlternative],
      2,
    );

    expect(related[0].fullName).toBe("northstar/trail");
    expect(related.some((repository) => repository.id === repositories[0].id)).toBe(false);
  });
});
