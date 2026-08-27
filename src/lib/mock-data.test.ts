import { describe, expect, it } from "vitest";

import {
  mockRepositories,
  findMockRepository,
  queryMockRepositories,
} from "@/lib/mock-data";

describe("mock discovery index", () => {
  it("contains unique repository identifiers", () => {
    const names = mockRepositories.map((repository) => repository.fullName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("finds repository paths without case sensitivity", () => {
    expect(findMockRepository("ASTRAL-SH", "UV")?.fullName).toBe("astral-sh/uv");
  });

  it("filters by topic and sorts results", () => {
    const results = queryMockRepositories({ query: "linux", sort: "stars" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((repository) =>
      [repository.fullName, repository.description, ...repository.topics]
        .join(" ")
        .toLowerCase()
        .includes("linux"),
    )).toBe(true);
    expect(results[0].stars).toBeGreaterThanOrEqual(results.at(-1)?.stars ?? 0);
  });
});
