import { describe, expect, it } from "vitest";

import {
  filterRepositories,
  findRelatedRepositories,
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
