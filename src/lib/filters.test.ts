import { describe, expect, it } from "vitest";

import {
  applyRepositoryFilters,
  countActiveFilters,
  parseActivityWindow,
  parseAgeWindow,
  parseFlag,
  parseForkFloor,
  parseLicenseFilter,
  parseStarFloor,
  type Repository,
} from "@/lib/repositories";
import { repositoryFilterQualifiers } from "@/lib/github";
import {
  buildFilterHref,
  parseRepositoryFilters,
  writeRepositoryFilters,
} from "@/lib/search-params";

const now = Date.parse("2026-09-04T00:00:00.000Z");

function repository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 1,
    owner: "acme",
    name: "widget",
    fullName: "acme/widget",
    description: "A widget",
    stars: 500,
    forks: 50,
    openIssues: 2,
    watchers: 10,
    language: "Rust",
    license: "MIT",
    topics: ["cli"],
    createdAt: "2025-09-04T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    pushedAt: "2026-09-01T00:00:00.000Z",
    starDelta7d: 10,
    contributorCount: 3,
    isVerified: false,
    ...overrides,
  };
}

describe("filter parsing", () => {
  it("only accepts values the interface actually offers", () => {
    expect(parseStarFloor("1000")).toBe(1_000);
    expect(parseStarFloor("50000")).toBe(50_000);
    expect(parseStarFloor("7")).toBe(0);
    expect(parseForkFloor("100")).toBe(100);
    expect(parseForkFloor("99")).toBe(0);
    expect(parseAgeWindow("1095")).toBe(1_095);
    expect(parseAgeWindow("3")).toBe(0);
    expect(parseActivityWindow("30")).toBe(30);
    expect(parseActivityWindow("1095")).toBe(0);
    expect(parseLicenseFilter("APACHE-2.0")).toBe("apache-2.0");
    expect(parseLicenseFilter("not-a-license")).toBe("");
    expect(parseFlag("1")).toBe(true);
    expect(parseFlag("0")).toBe(false);
  });

  it("round-trips filters through URL parameters", () => {
    const filters = {
      minStars: 1_000,
      minForks: 100,
      maxAgeDays: 365,
      activeWithinDays: 30,
      license: "mit" as const,
      hideArchived: true,
      goodFirstIssues: true,
      includeForks: true,
    };
    const params = writeRepositoryFilters(new URLSearchParams(), filters);
    expect(params.toString()).toBe(
      "stars=1000&forks=100&age=365&active=30&license=mit&archived=0&gfi=1&forked=1",
    );
    expect(parseRepositoryFilters(Object.fromEntries(params))).toEqual(filters);
  });

  it("omits defaults from the URL", () => {
    expect(writeRepositoryFilters(new URLSearchParams(), {}).toString()).toBe("");
  });

  it("counts only the filters a visitor set", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ minStars: 100, license: "mit" })).toBe(2);
    expect(countActiveFilters({ minStars: 0, hideArchived: false })).toBe(0);
  });
});

describe("applyRepositoryFilters", () => {
  it("returns the input untouched when nothing is filtered", () => {
    const pool = [repository()];
    expect(applyRepositoryFilters(pool, {}, now)).toBe(pool);
  });

  it("filters by stars, forks, creation date, and last push", () => {
    const pool = [
      repository({ fullName: "a/small", stars: 50 }),
      repository({ fullName: "a/fewforks", forks: 1 }),
      repository({ fullName: "a/old", createdAt: "2019-01-01T00:00:00.000Z" }),
      repository({ fullName: "a/stale", pushedAt: "2024-01-01T00:00:00.000Z" }),
      repository({ fullName: "a/good" }),
    ];
    const kept = applyRepositoryFilters(
      pool,
      { minStars: 100, minForks: 10, maxAgeDays: 365, activeWithinDays: 30 },
      now,
    );
    expect(kept.map((item) => item.fullName)).toEqual(["a/good"]);
  });

  it("treats NOASSERTION and Not specified as unlicensed", () => {
    const pool = [
      repository({ fullName: "a/mit", license: "MIT" }),
      repository({ fullName: "a/custom", license: "NOASSERTION" }),
      repository({ fullName: "a/none", license: "Not specified" }),
    ];
    expect(
      applyRepositoryFilters(pool, { license: "mit" }, now).map((r) => r.fullName),
    ).toEqual(["a/mit"]);
    expect(
      applyRepositoryFilters(pool, { license: "none" }, now).map((r) => r.fullName),
    ).toEqual(["a/custom", "a/none"]);
  });
});

describe("repositoryFilterQualifiers", () => {
  it("maps every filter to a real GitHub qualifier", () => {
    expect(
      repositoryFilterQualifiers(
        {
          minStars: 1_000,
          minForks: 100,
          maxAgeDays: 30,
          activeWithinDays: 7,
          license: "apache-2.0",
          hideArchived: true,
          goodFirstIssues: true,
          includeForks: true,
        },
        now,
      ),
    ).toEqual([
      "stars:>=1000",
      "forks:>=100",
      "created:>=2026-08-05",
      "pushed:>=2026-08-28",
      "license:apache-2.0",
      "archived:false",
      "good-first-issues:>0",
      "fork:true",
    ]);
  });

  it("emits nothing for defaults, and no qualifier for license:none", () => {
    expect(repositoryFilterQualifiers({}, now)).toEqual([]);
    expect(repositoryFilterQualifiers({ license: "none" }, now)).toEqual([]);
  });
});

describe("buildFilterHref", () => {
  const base = {
    pathname: "/explore",
    sort: "rising" as const,
    defaultSort: "rising" as const,
    filters: { minStars: 1_000 },
    base: { topic: "terminal", language: "" },
  };

  it("keeps unchanged state and drops the default sort", () => {
    expect(buildFilterHref({ ...base, changes: { minForks: 10 } })).toBe(
      "/explore?topic=terminal&stars=1000&forks=10",
    );
  });

  it("clears a filter when a change sets it back to the default", () => {
    expect(buildFilterHref({ ...base, changes: { minStars: 0 } })).toBe(
      "/explore?topic=terminal",
    );
  });

  it("writes a non-default sort and returns a bare path when nothing is set", () => {
    expect(
      buildFilterHref({
        pathname: "/search",
        sort: "relevance",
        defaultSort: "relevance",
        filters: {},
      }),
    ).toBe("/search");
    expect(buildFilterHref({ ...base, changes: { sort: "newest" } })).toBe(
      "/explore?sort=newest&topic=terminal&stars=1000",
    );
  });
});
