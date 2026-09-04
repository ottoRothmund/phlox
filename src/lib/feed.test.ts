import { describe, expect, it } from "vitest";

import {
  assembleFeedBatch,
  emptyTaste,
  parseTaste,
  planFeedQueries,
  sanitizeWeights,
  tasteSummary,
  updateTaste,
  wildcardTopics,
} from "@/lib/feed";
import { mockRepositories } from "@/lib/mock-data";

const now = Date.parse("2026-09-03T12:00:00Z");

describe("feed query planning", () => {
  it("always produces taste, wildcard, and fresh lanes", () => {
    const plans = planFeedQueries(emptyTaste, 7, now);
    expect(plans.map((plan) => plan.lane)).toEqual(["taste", "wildcard", "fresh"]);
  });

  it("is deterministic for a seed", () => {
    expect(planFeedQueries(emptyTaste, 42, now)).toEqual(
      planFeedQueries(emptyTaste, 42, now),
    );
    expect(planFeedQueries(emptyTaste, 42, now)).not.toEqual(
      planFeedQueries(emptyTaste, 43, now),
    );
  });

  it("aims the taste lane at a liked topic and ranks it by rising", () => {
    const plans = planFeedQueries(
      { topics: { tui: 6 }, languages: {} },
      1,
      now,
    );
    expect(plans[0].query).toContain("topic:tui");
    expect(plans[0].sort).toBe("rising");
    expect(plans[0].reason).toBe("Rising in Terminal UIs");
  });

  it("never aims the taste lane at a disliked topic", () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const plans = planFeedQueries(
        { topics: { ads: -4, "self-hosted": 3 }, languages: {} },
        seed,
        now,
      );
      expect(plans[0].query).not.toContain("topic:ads");
    }
  });

  it("draws the wildcard from the pool with a bounded star band and creation window", () => {
    const plan = planFeedQueries(emptyTaste, 99, now)[1];
    const topic = plan.query.match(/topic:([^\s]+)/)?.[1];
    expect(wildcardTopics.some((entry) => entry.slug === topic)).toBe(true);
    expect(plan.query).toMatch(/stars:40\.\.4000/);
    expect(plan.query).toMatch(/created:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/);
  });

  it("keeps the fresh lane inside the last month with a seeded window", () => {
    const windows = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = planFeedQueries(emptyTaste, seed, now)[2];
      const match = plan.query.match(/created:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/);
      expect(match).not.toBeNull();
      const [, start, end] = match!;
      expect(Date.parse(start)).toBeGreaterThanOrEqual(now - 30 * 86_400_000);
      expect(Date.parse(end)).toBeLessThanOrEqual(now);
      expect(plan.query).toMatch(/stars:(15\.\.300|>300)/);
      windows.add(start);
    }
    expect(windows.size).toBeGreaterThan(3);
  });
});

describe("feed batch assembly", () => {
  const plans = planFeedQueries(emptyTaste, 3, now);

  it("interleaves lanes, dedupes, and honors the exclude list", () => {
    const [a, b, c, d] = mockRepositories;
    const items = assembleFeedBatch(
      [
        { plan: plans[0], repositories: [a, b] },
        { plan: plans[1], repositories: [b, c] },
        { plan: plans[2], repositories: [d] },
      ],
      [d.fullName.toUpperCase()],
      3,
      10,
    );
    const names = items.map((item) => item.repository.fullName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain(d.fullName);
    expect(names.sort()).toEqual([a.fullName, b.fullName, c.fullName].sort());
  });

  it("tags each item with the lane that produced it", () => {
    const items = assembleFeedBatch(
      [{ plan: plans[2], repositories: [mockRepositories[0]] }],
      [],
      1,
    );
    expect(items[0].lane).toBe("fresh");
    expect(items[0].reason).toBe("Created this month");
    expect(items[0].visual).toBeNull();
  });

  it("respects the batch limit", () => {
    const items = assembleFeedBatch(
      [{ plan: plans[0], repositories: mockRepositories }],
      [],
      1,
      4,
    );
    expect(items).toHaveLength(4);
  });
});

describe("taste model", () => {
  const repository = { topics: ["tui", "rust"], language: "Rust" };

  it("rewards likes and saves, punishes dislikes, and nudges on skips", () => {
    expect(updateTaste(emptyTaste, repository, "like").topics.tui).toBe(2);
    expect(updateTaste(emptyTaste, repository, "save").topics.tui).toBe(3);
    expect(updateTaste(emptyTaste, repository, "dislike").topics.tui).toBe(-1.5);
    expect(updateTaste(emptyTaste, repository, "skip").topics.tui).toBe(-0.15);
    expect(updateTaste(emptyTaste, repository, "like").languages.Rust).toBe(1);
  });

  it("ignores the Other language bucket", () => {
    const taste = updateTaste(emptyTaste, { topics: [], language: "Other" }, "like");
    expect(taste.languages).toEqual({});
  });

  it("keeps the model bounded", () => {
    let taste = emptyTaste;
    for (let index = 0; index < 80; index += 1) {
      taste = updateTaste(taste, { topics: [`topic-${index}`], language: "Go" }, "like");
    }
    expect(Object.keys(taste.topics).length).toBeLessThanOrEqual(40);
  });

  it("summarizes only positive topics, strongest first", () => {
    expect(
      tasteSummary({ topics: { tui: 5, rust: 2, ads: -3 }, languages: {} }),
    ).toEqual(["Terminal UIs", "Rust"]);
  });

  it("parses stored taste defensively", () => {
    expect(parseTaste(null)).toEqual(emptyTaste);
    expect(parseTaste("not json")).toEqual(emptyTaste);
    expect(parseTaste(JSON.stringify({ topics: { tui: 2, bad: "x" }, languages: 3 }))).toEqual({
      topics: { tui: 2 },
      languages: {},
    });
    expect(sanitizeWeights({ "<script>": 1, ok: Number.NaN, fine: 1 })).toEqual({ fine: 1 });
  });
});
