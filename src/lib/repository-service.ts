import {
  getGitHubRepository,
  searchGitHubRepositories,
} from "@/lib/github";
import {
  findMockRepository,
  queryMockRepositories,
} from "@/lib/mock-data";
import {
  getMostLikedRepositories,
  getRepositoryReactionCounts,
  registerRepositoryTopics,
  type ReactionCounts,
} from "@/lib/phlox-data";
import {
  MAX_SEARCH_QUERY_LENGTH,
  applyRepositoryFilters,
  findRelatedRepositories,
  sortRepositories,
  type Repository,
  type RepositoryFilters,
  type RepositorySort,
} from "@/lib/repositories";

export interface RepositorySearchOptions {
  query?: string;
  sort?: RepositorySort;
  topic?: string;
  language?: string;
  filters?: RepositoryFilters;
  limit?: number;
  preferLive?: boolean;
  liveSearch?: typeof searchGitHubRepositories;
  liveGet?: typeof getGitHubRepository;
  registerTopics?: typeof registerRepositoryTopics;
  loadReactionCounts?: typeof getRepositoryReactionCounts;
  loadMostLiked?: typeof getMostLikedRepositories;
}

export interface RepositorySearchResult {
  repositories: Repository[];
  source: "github" | "index" | "phlox";
  /** Reaction totals keyed by lower-cased full name, for every result. */
  reactionCounts: Record<string, ReactionCounts>;
}

function localFallbackQuery(query: string): string {
  return query
    .replace(
      /\b(?:archived|created|followers|forks|good-first-issues|help-wanted-issues|is|language|license|mirror|org|pushed|repo|size|sponsor|stars|template|topic|updated|user):(?:"[^"]*"|\S+)/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function matchesFacets(
  repository: Repository,
  topic?: string,
  language?: string,
): boolean {
  if (topic && !repository.topics.includes(topic.toLocaleLowerCase())) {
    return false;
  }
  if (
    language &&
    repository.language.toLocaleLowerCase() !== language.toLocaleLowerCase()
  ) {
    return false;
  }
  return true;
}

/**
 * "Most liked" with no query is a Phlox-native list: the repositories people
 * here liked most, hydrated from GitHub so stars and activity are current.
 * GitHub cannot answer this question itself, so it gets its own path.
 */
async function searchMostLiked({
  topic,
  language,
  filters,
  limit,
  liveGet,
  loadMostLiked,
}: {
  topic?: string;
  language?: string;
  filters: RepositoryFilters;
  limit: number;
  liveGet: typeof getGitHubRepository;
  loadMostLiked: typeof getMostLikedRepositories;
}): Promise<RepositorySearchResult | null> {
  const liked = await loadMostLiked(Math.min(limit * 2, 60)).catch(() => []);
  if (liked.length === 0) return null;

  const hydrated = await Promise.all(
    liked.map(async ({ fullName }) => {
      const [owner, name] = fullName.split("/");
      try {
        return await liveGet(owner, name);
      } catch {
        return findMockRepository(owner, name) ?? null;
      }
    }),
  );
  const reactionCounts = Object.fromEntries(
    liked.map(({ fullName, likes, dislikes }) => [fullName, { likes, dislikes }]),
  );
  const repositories = applyRepositoryFilters(
    hydrated.filter(
      (repository): repository is Repository =>
        repository !== null && matchesFacets(repository, topic, language),
    ),
    filters,
  );

  return {
    repositories: sortRepositories(repositories, "likes", { reactionCounts }).slice(
      0,
      limit,
    ),
    source: "phlox",
    reactionCounts,
  };
}

export async function searchRepositories({
  query = "",
  sort = "rising",
  topic,
  language,
  filters = {},
  limit = 24,
  preferLive = true,
  liveSearch = searchGitHubRepositories,
  liveGet = getGitHubRepository,
  registerTopics = registerRepositoryTopics,
  loadReactionCounts = getRepositoryReactionCounts,
  loadMostLiked = getMostLikedRepositories,
}: RepositorySearchOptions = {}): Promise<RepositorySearchResult> {
  const normalizedQuery = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const normalizedTopic = topic?.trim().match(/^[a-z0-9._+-]+$/i)?.[0];
  const normalizedLanguage = language?.trim().match(/^[a-z0-9.+#-]+$/i)?.[0];
  const hasFreeText = localFallbackQuery(normalizedQuery).length > 0;

  if (sort === "likes" && !hasFreeText && preferLive) {
    const liked = await searchMostLiked({
      topic: normalizedTopic,
      language: normalizedLanguage,
      filters,
      limit,
      liveGet,
      loadMostLiked,
    });
    if (liked && liked.repositories.length > 0) return liked;
  }

  const liveQuery = [
    normalizedQuery,
    normalizedTopic ? `topic:${normalizedTopic}` : "",
    normalizedLanguage ? `language:${normalizedLanguage}` : "",
    filters.minStars ? `stars:>=${filters.minStars}` : "",
    filters.maxAgeDays
      ? `created:>=${new Date(Date.now() - filters.maxAgeDays * 86_400_000).toISOString().slice(0, 10)}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const finish = async (
    pool: Repository[],
    source: RepositorySearchResult["source"],
  ): Promise<RepositorySearchResult> => {
    const filtered = applyRepositoryFilters(pool, filters);
    const reactionCounts = await loadReactionCounts(
      filtered.map((repository) => repository.fullName),
    ).catch(() => ({}));
    return {
      repositories: sortRepositories(filtered, sort, { reactionCounts }).slice(
        0,
        limit,
      ),
      source,
      reactionCounts,
    };
  };

  if (preferLive && liveQuery.length >= 2) {
    try {
      // Fetch a slightly larger pool when reranking locally so the local sort
      // has something to reorder beyond GitHub's own top-N.
      const poolSize = sort === "relevance" ? limit : Math.min(limit * 2, 60);
      const repositories = await liveSearch(liveQuery, sort, poolSize);
      if (repositories.length > 0) {
        return finish(repositories, "github");
      }
    } catch {
      // Public GitHub requests can be rate-limited. The local index keeps search useful.
    }
  }

  const repositories = queryMockRepositories({
    query: localFallbackQuery(normalizedQuery),
    sort: sort === "likes" ? "stars" : sort,
    topic,
    language,
  });
  await Promise.allSettled(
    repositories
      .slice(0, limit)
      .map((repository) => registerTopics(repository.fullName, repository.topics)),
  );
  return finish(repositories, "index");
}

/**
 * Related repositories from GitHub: same primary topics or language, scored
 * by findRelatedRepositories. The local index is only a fallback so the
 * section is never empty when GitHub is rate-limited.
 */
/**
 * Topics that describe where a project runs or what it is written in, not
 * what it does. GitHub lists topics alphabetically, so without this
 * "android, asyncio" would represent a terminal file manager.
 */
const genericTopics = new Set([
  "android", "ios", "linux", "macos", "windows", "web", "mobile", "desktop",
  "cross-platform", "open-source", "opensource", "hacktoberfest", "awesome",
  "awesome-list", "library", "framework", "tool", "tools", "app", "application",
  "developer-tools", "devtools", "productivity", "utility", "utilities",
  "c", "cpp", "csharp", "go", "golang", "java", "javascript", "typescript",
  "python", "python3", "rust", "rust-lang", "ruby", "php", "swift", "kotlin",
  "zig", "nix", "lua", "shell", "bash", "html", "css", "nodejs", "node",
  "react", "asyncio", "async", "concurrency", "performance", "fast",
]);

export function pickDescriptiveTopics(topics: string[], count = 2): string[] {
  const valid = topics.filter((topic) => /^[a-z0-9._+-]+$/i.test(topic));
  const specific = valid.filter((topic) => !genericTopics.has(topic.toLocaleLowerCase()));
  // Longer, hyphenated topics ("file-manager") say more than short ones ("cli").
  const ranked = [...specific].sort((a, b) => b.length - a.length);
  return (ranked.length > 0 ? ranked : valid).slice(0, count);
}

export async function getRelatedRepositories(
  repository: Repository,
  limit = 5,
  liveSearch: typeof searchGitHubRepositories = searchGitHubRepositories,
): Promise<Repository[]> {
  const topics = pickDescriptiveTopics(repository.topics, 2);
  const language = repository.language.match(/^[a-z0-9.+#-]+$/i)?.[0];
  // One descriptive topic plus the language casts a wider net than two
  // ANDed topics, and findRelatedRepositories rescored by all shared topics.
  const query = [
    topics[0] ? `topic:${topics[0]}` : "",
    language && language !== "Other" ? `language:${language}` : "",
    "stars:>=50",
  ]
    .filter(Boolean)
    .join(" ");

  let candidates: Repository[] = [];
  if (topics.length > 0 || language) {
    try {
      candidates = await liveSearch(query, "stars", 30);
    } catch {
      candidates = [];
    }
  }
  const pool = candidates.length > 0 ? candidates : queryMockRepositories({});
  const related = findRelatedRepositories(repository, pool, limit);
  return related.length > 0
    ? related
    : findRelatedRepositories(repository, queryMockRepositories({}), limit);
}

export async function getRepository(
  owner: string,
  name: string,
  liveGet: typeof getGitHubRepository = getGitHubRepository,
  registerTopics: typeof registerRepositoryTopics = registerRepositoryTopics,
): Promise<Repository | null> {
  // GitHub is authoritative: only it can confirm a repository is public and real.
  // The local index is an availability fallback, never a source of truth.
  try {
    return await liveGet(owner, name);
  } catch {
    const indexed = findMockRepository(owner, name);
    if (!indexed) throw new Error("GitHub is unavailable for this repository.");
    await Promise.allSettled([registerTopics(indexed.fullName, indexed.topics)]);
    return indexed;
  }
}
