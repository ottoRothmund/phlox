import {
  getGitHubRepository,
  searchGitHubRepositories,
} from "@/lib/github";
import {
  findMockRepository,
  queryMockRepositories,
} from "@/lib/mock-data";
import { registerRepositoryTopics } from "@/lib/phlox-data";
import {
  MAX_SEARCH_QUERY_LENGTH,
  sortRepositories,
  type Repository,
  type RepositorySort,
} from "@/lib/repositories";

export interface RepositorySearchOptions {
  query?: string;
  sort?: RepositorySort;
  topic?: string;
  language?: string;
  limit?: number;
  preferLive?: boolean;
  liveSearch?: typeof searchGitHubRepositories;
  registerTopics?: typeof registerRepositoryTopics;
}

export interface RepositorySearchResult {
  repositories: Repository[];
  source: "github" | "index";
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

export async function searchRepositories({
  query = "",
  sort = "rising",
  topic,
  language,
  limit = 24,
  preferLive = true,
  liveSearch = searchGitHubRepositories,
  registerTopics = registerRepositoryTopics,
}: RepositorySearchOptions = {}): Promise<RepositorySearchResult> {
  const normalizedQuery = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const normalizedTopic = topic?.trim().match(/^[a-z0-9._+-]+$/i)?.[0];
  const normalizedLanguage = language?.trim().match(/^[a-z0-9.+#-]+$/i)?.[0];
  const liveQuery = [
    normalizedQuery,
    normalizedTopic ? `topic:${normalizedTopic}` : "",
    normalizedLanguage ? `language:${normalizedLanguage}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (preferLive && liveQuery.length >= 2) {
    try {
      const repositories = await liveSearch(liveQuery, sort, limit);
      if (repositories.length > 0) {
        return {
          repositories: sortRepositories(repositories, sort),
          source: "github",
        };
      }
    } catch {
      // Public GitHub requests can be rate-limited. The local index keeps search useful.
    }
  }

  const repositories = queryMockRepositories({
    query: localFallbackQuery(normalizedQuery),
    sort,
    topic,
    language,
  }).slice(0, limit);
  await Promise.allSettled(
    repositories.map((repository) =>
      registerTopics(repository.fullName, repository.topics),
    ),
  );
  return {
    repositories,
    source: "index",
  };
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
