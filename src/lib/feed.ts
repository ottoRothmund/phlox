import type { Repository, RepositorySort } from "@/lib/repositories";

/**
 * A visitor's taste, learned from what they like, dislike, and save in the
 * feed. Weights are unbounded floats; positive means "show me more of this".
 */
export interface FeedTaste {
  topics: Record<string, number>;
  languages: Record<string, number>;
}

export type FeedLane = "taste" | "wildcard" | "fresh";

export interface FeedQueryPlan {
  lane: FeedLane;
  /** Human reason shown on the card, e.g. "Rising in Terminal". */
  reason: string;
  query: string;
  sort: RepositorySort;
}

export interface FeedVisual {
  url: string;
  kind: "screenshot" | "social";
}

export interface FeedItem {
  repository: Repository;
  reason: string;
  lane: FeedLane;
  visual: FeedVisual | null;
}

export const emptyTaste: FeedTaste = { topics: {}, languages: {} };

export const MAX_TASTE_ENTRIES = 40;
export const MAX_EXCLUDE = 400;
export const FEED_BATCH_SIZE = 10;

/**
 * Topics that reliably yield interesting, discoverable repositories. This is
 * the wildcard pool: it exists so a fresh visitor with no taste still sees
 * variety, and so a visitor with strong taste keeps getting nudged sideways.
 */
export const wildcardTopics: { slug: string; label: string }[] = [
  { slug: "cli", label: "CLI tools" },
  { slug: "tui", label: "Terminal UIs" },
  { slug: "self-hosted", label: "Self-hosted" },
  { slug: "homelab", label: "Homelab" },
  { slug: "rust", label: "Rust" },
  { slug: "zig", label: "Zig" },
  { slug: "golang", label: "Go" },
  { slug: "webassembly", label: "WebAssembly" },
  { slug: "game-engine", label: "Game engines" },
  { slug: "emulator", label: "Emulators" },
  { slug: "compiler", label: "Compilers" },
  { slug: "database", label: "Databases" },
  { slug: "local-first", label: "Local-first" },
  { slug: "p2p", label: "Peer-to-peer" },
  { slug: "esp32", label: "ESP32" },
  { slug: "raspberry-pi", label: "Raspberry Pi" },
  { slug: "3d-printing", label: "3D printing" },
  { slug: "reverse-engineering", label: "Reverse engineering" },
  { slug: "llm", label: "LLMs" },
  { slug: "ai-agents", label: "AI agents" },
  { slug: "mcp", label: "MCP servers" },
  { slug: "neovim", label: "Neovim" },
  { slug: "wayland", label: "Wayland" },
  { slug: "macos", label: "macOS" },
  { slug: "audio", label: "Audio" },
  { slug: "creative-coding", label: "Creative coding" },
  { slug: "shaders", label: "Shaders" },
  { slug: "keyboard", label: "Keyboards" },
  { slug: "ebpf", label: "eBPF" },
  { slug: "operating-system", label: "Operating systems" },
  { slug: "browser-extension", label: "Browser extensions" },
  { slug: "privacy", label: "Privacy" },
  { slug: "cryptography", label: "Cryptography" },
  { slug: "networking", label: "Networking" },
  { slug: "e2ee", label: "End-to-end encryption" },
  { slug: "static-site-generator", label: "Static site generators" },
  { slug: "markdown", label: "Markdown" },
  { slug: "pdf", label: "PDF tooling" },
  { slug: "scraping", label: "Scraping" },
  { slug: "observability", label: "Observability" },
];

/** Small deterministic PRNG so a seed reproduces a batch exactly. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function weightedPick(
  weights: Record<string, number>,
  random: () => number,
): string | null {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function isoDaysAgo(days: number, now: number): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

function humanTopic(slug: string): string {
  const known = wildcardTopics.find((topic) => topic.slug === slug);
  if (known) return known.label;
  const words = slug.replace(/[._+-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Plan the GitHub searches behind one feed batch. Three lanes, always:
 *
 * - taste: a topic (or language) weighted by what the visitor liked, ranked
 *   by relative velocity so it surfaces things they have not seen yet.
 * - wildcard: a random topic from the pool, restricted to a random 90-day
 *   creation window and a modest star band. These are the deep cuts — good
 *   projects that never hit the front page.
 * - fresh: repositories created in the last two weeks with a few stars.
 *
 * Every lane is deterministic for a seed so the same seed reproduces the
 * same batch, which keeps caching honest and bugs reproducible.
 */
export function planFeedQueries(
  taste: FeedTaste,
  seed: number,
  now = Date.now(),
): FeedQueryPlan[] {
  const random = seededRandom(seed);
  const plans: FeedQueryPlan[] = [];

  const tasteTopic = weightedPick(taste.topics, random);
  const tasteLanguage = weightedPick(taste.languages, random);
  if (tasteTopic) {
    plans.push({
      lane: "taste",
      reason: `Rising in ${humanTopic(tasteTopic)}`,
      query: `topic:${tasteTopic} stars:>20 pushed:>${isoDaysAgo(60, now)}`,
      sort: "rising",
    });
  } else if (tasteLanguage) {
    plans.push({
      lane: "taste",
      reason: `Rising in ${tasteLanguage}`,
      query: `language:${tasteLanguage} stars:>20 pushed:>${isoDaysAgo(60, now)}`,
      sort: "rising",
    });
  } else {
    const topic = pick(wildcardTopics, random);
    plans.push({
      lane: "taste",
      reason: `Rising in ${topic.label}`,
      query: `topic:${topic.slug} stars:>20 pushed:>${isoDaysAgo(60, now)}`,
      sort: "rising",
    });
  }

  const wildcard = pick(wildcardTopics, random);
  const windowEndDays = 90 + Math.floor(random() * 900);
  const windowStartDays = windowEndDays + 90;
  const languageQualifier =
    tasteLanguage && random() < 0.4 ? ` language:${tasteLanguage}` : "";
  plans.push({
    lane: "wildcard",
    reason: wildcard.label,
    query: `topic:${wildcard.slug} stars:40..4000 created:${isoDaysAgo(windowStartDays, now)}..${isoDaysAgo(windowEndDays, now)} pushed:>${isoDaysAgo(180, now)}${languageQualifier}`,
    sort: "stars",
  });

  // Random 12-day window inside the last month, alternating between a
  // "people noticed" band and a "nobody noticed yet" band. Sorting a fixed
  // window by stars would open every session with the same three hype repos.
  const freshEndDays = Math.floor(random() * 18);
  const freshBand = random() < 0.5 ? "stars:15..300" : "stars:>300";
  plans.push({
    lane: "fresh",
    reason: "Created this month",
    query: `created:${isoDaysAgo(freshEndDays + 12, now)}..${isoDaysAgo(freshEndDays, now)} ${freshBand}`,
    sort: "rising",
  });

  return plans;
}

/**
 * Interleave lane results into one batch, dropping anything the visitor has
 * already seen and anything that appears twice. Order within the batch is
 * shuffled by seed so consecutive cards do not all come from one lane.
 */
export function assembleFeedBatch(
  lanes: { plan: FeedQueryPlan; repositories: Repository[] }[],
  exclude: Iterable<string>,
  seed: number,
  limit = FEED_BATCH_SIZE,
): FeedItem[] {
  const excluded = new Set(
    [...exclude].map((fullName) => fullName.toLocaleLowerCase()),
  );
  const random = seededRandom(seed ^ 0x9e3779b9);
  const queues = lanes.map(({ plan, repositories }) => ({
    plan,
    repositories: [...repositories],
  }));
  const items: FeedItem[] = [];

  while (items.length < limit && queues.some((queue) => queue.repositories.length)) {
    for (const queue of queues) {
      if (items.length >= limit) break;
      const repository = queue.repositories.shift();
      if (!repository) continue;
      const key = repository.fullName.toLocaleLowerCase();
      if (excluded.has(key)) continue;
      excluded.add(key);
      items.push({
        repository,
        reason: queue.plan.reason,
        lane: queue.plan.lane,
        visual: null,
      });
    }
  }

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

export type TasteSignal = "like" | "dislike" | "save" | "skip";

const signalWeights: Record<TasteSignal, number> = {
  like: 2,
  save: 3,
  dislike: -1.5,
  skip: -0.15,
};

/**
 * Fold one interaction into the taste model. Topics carry the full signal,
 * language carries half. Entries are trimmed to the strongest few so the
 * model cannot grow without bound in localStorage.
 */
export function updateTaste(
  taste: FeedTaste,
  repository: Pick<Repository, "topics" | "language">,
  signal: TasteSignal,
): FeedTaste {
  const weight = signalWeights[signal];
  const topics = { ...taste.topics };
  for (const topic of repository.topics.slice(0, 8)) {
    const slug = topic.toLocaleLowerCase();
    topics[slug] = (topics[slug] ?? 0) + weight;
  }
  const languages = { ...taste.languages };
  if (repository.language && repository.language !== "Other") {
    languages[repository.language] =
      (languages[repository.language] ?? 0) + weight / 2;
  }
  return { topics: trim(topics), languages: trim(languages) };
}

function trim(weights: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(weights)
      .filter(([, weight]) => Math.abs(weight) > 0.01)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, MAX_TASTE_ENTRIES),
  );
}

export function parseTaste(serialized: string | null): FeedTaste {
  if (!serialized) return emptyTaste;
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== "object" || value === null) return emptyTaste;
    const record = value as Record<string, unknown>;
    return {
      topics: sanitizeWeights(record.topics),
      languages: sanitizeWeights(record.languages),
    };
  } catch {
    return emptyTaste;
  }
}

export function sanitizeWeights(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[0].length <= 60 &&
          /^[a-z0-9][a-z0-9._+#-]*$/i.test(entry[0]),
      )
      .slice(0, MAX_TASTE_ENTRIES),
  );
}

/** Top taste entries, for the "your taste" strip in the feed header. */
export function tasteSummary(taste: FeedTaste, limit = 5): string[] {
  return Object.entries(taste.topics)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug]) => humanTopic(slug));
}
