import {
  MAX_SEARCH_QUERY_LENGTH,
  type Repository,
  type RepositorySort,
} from "@/lib/repositories";
import { registerRepositoryTopics } from "@/lib/phlox-data";

export interface GitHubRepositoryApi {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  subscribers_count?: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  topics?: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
}

interface GitHubSearchResponse {
  items: GitHubRepositoryApi[];
}

interface GitHubReadmeApi {
  content: string;
  encoding: string;
  path: string;
  html_url: string;
}

export interface RepositoryReadme {
  content: string;
  path: string;
  htmlUrl: string;
  screenshotUrls: string[];
}

function estimateRecentGrowth(repository: GitHubRepositoryApi): number {
  const ageInDays = Math.max(
    1,
    (Date.now() - Date.parse(repository.created_at)) / 86_400_000,
  );
  const baselineWeeklyGrowth = (repository.stargazers_count / ageInDays) * 7;
  const recentlyUpdated =
    Date.now() - Date.parse(repository.pushed_at) < 14 * 86_400_000 ? 1.35 : 0.7;

  return Math.max(1, Math.round(baselineWeeklyGrowth * recentlyUpdated));
}

function safeHttpUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? normalized
      : undefined;
  } catch {
    return undefined;
  }
}

export function mapGitHubRepository(
  source: GitHubRepositoryApi,
): Repository {
  const repository: Repository = {
    id: source.id,
    owner: source.owner.login,
    name: source.name,
    fullName: source.full_name,
    description: source.description?.trim() || "No description provided.",
    stars: source.stargazers_count,
    forks: source.forks_count,
    openIssues: source.open_issues_count,
    watchers: source.subscribers_count ?? 0,
    language: source.language || "Other",
    license: source.license?.spdx_id || "Not specified",
    topics: source.topics || [],
    createdAt: source.created_at,
    updatedAt: source.updated_at,
    pushedAt: source.pushed_at,
    starDelta7d: estimateRecentGrowth(source),
    contributorCount: Math.max(
      1,
      Math.round(Math.sqrt(source.forks_count + source.watchers_count)),
    ),
    growthEstimated: true,
    contributorsEstimated: true,
    isVerified: false,
    homepage: safeHttpUrl(source.homepage),
    avatarUrl: source.owner.avatar_url,
    htmlUrl: source.html_url,
  };

  return repository;
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "phlox-discovery",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export function buildGitHubSearchQuery(query: string): string {
  const normalized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const hasPublicQualifier = normalized
    .split(/\s+/)
    .some((token) => /^is:public$/i.test(token));
  return hasPublicQualifier
    ? normalized
    : `${normalized} is:public`;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Shape the candidate pool for discovery sorts. GitHub best-match on a bare
 * stars qualifier returns the same famous mega-repositories every time, so a
 * "rising" feed built from it can only ever rerank giants. Restricting the
 * pool — young repositories for rising, recently pushed for trending — gives
 * the client-side velocity scoring something real to rank. User-supplied
 * created:/pushed: qualifiers are respected and never overridden.
 */
export function buildDiscoveryPoolQuery(
  query: string,
  sort: RepositorySort,
): string {
  const hasQualifier = (name: string) =>
    new RegExp(`(^|\\s)${name}:`, "i").test(query);

  if (sort === "rising" && !hasQualifier("created")) {
    return `${query} created:>${isoDaysAgo(270)}`.trim();
  }
  if (sort === "trending" && !hasQualifier("pushed")) {
    return `${query} pushed:>${isoDaysAgo(14)}`.trim();
  }
  // GitHub cannot sort by creation date. Restrict the pool to young
  // repositories ordered by stars, then the client sorts by createdAt, so
  // "newest" means "new and already noticed" rather than the last 30 empty
  // repositories someone pushed.
  if (sort === "newest" && !hasQualifier("created")) {
    return `${query} created:>${isoDaysAgo(60)}`.trim();
  }
  return query;
}

/**
 * The GitHub-side sort for a Phlox sort. Only stars, forks, and updated exist
 * upstream; every other sort fetches a star-ordered pool and reranks locally.
 */
export function githubSortParameter(sort: RepositorySort): string {
  switch (sort) {
    case "relevance":
      return "";
    case "updated":
      return "&sort=updated&order=desc";
    case "forks":
      return "&sort=forks&order=desc";
    default:
      return "&sort=stars&order=desc";
  }
}

export function isPublicGitHubRepository(
  repository: GitHubRepositoryApi,
): boolean {
  return repository.private === false;
}

export async function searchGitHubRepositories(
  query: string,
  sort: RepositorySort = "stars",
  limit = 24,
  registerTopics: typeof registerRepositoryTopics = registerRepositoryTopics,
): Promise<Repository[]> {
  const githubSort = githubSortParameter(sort);
  const publicQuery = buildGitHubSearchQuery(
    buildDiscoveryPoolQuery(query, sort),
  );
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(publicQuery)}${githubSort}&per_page=${limit}`,
    {
      headers: githubHeaders(),
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GitHubSearchResponse;
  const repositories = payload.items
    .filter(isPublicGitHubRepository)
    .map(mapGitHubRepository);
  await Promise.allSettled(
    repositories.map((repository) =>
      registerTopics(repository.fullName, repository.topics),
    ),
  );
  return repositories;
}

export async function getGitHubRepository(
  owner: string,
  name: string,
  registerTopics: typeof registerRepositoryTopics = registerRepositoryTopics,
): Promise<Repository | null> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    {
      headers: githubHeaders(),
      next: { revalidate: 300 },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub repository request failed with status ${response.status}`);
  }

  const repository = (await response.json()) as GitHubRepositoryApi;
  if (!isPublicGitHubRepository(repository)) return null;

  const mapped = mapGitHubRepository(repository);
  await Promise.allSettled([registerTopics(mapped.fullName, mapped.topics)]);
  return mapped;
}

export function resolveReadmeAssetUrl(
  source: string,
  owner: string,
  name: string,
  readmePath: string,
): string | null {
  const normalized = source.trim().replace(/^<|>$/g, "");
  if (!normalized || normalized.startsWith("data:")) return null;

  try {
    const absolute = new URL(normalized);
    const pathParts = absolute.pathname.split("/").filter(Boolean);
    if (
      absolute.hostname === "github.com" &&
      pathParts.length >= 5 &&
      pathParts[2] === "blob"
    ) {
      const [assetOwner, assetRepository, , branch, ...assetPath] = pathParts;
      return `https://raw.githubusercontent.com/${assetOwner}/${assetRepository}/${branch}/${assetPath.join("/")}`;
    }
    return absolute.protocol === "http:" || absolute.protocol === "https:"
      ? absolute.toString()
      : null;
  } catch {
    const repositoryRoot = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/HEAD/`;
    const directory = readmePath.includes("/")
      ? readmePath.slice(0, readmePath.lastIndexOf("/") + 1)
      : "";
    return new URL(
      normalized.startsWith("/") ? normalized.slice(1) : normalized,
      normalized.startsWith("/") ? repositoryRoot : `${repositoryRoot}${directory}`,
    ).toString();
  }
}

function isScreenshot(source: string, alt: string): boolean {
  const lowered = `${source} ${alt}`.toLocaleLowerCase();
  if (
    /badge|shield|codecov|coverage|build-status|logo|brand-assets|sponsor|available for/.test(
      lowered,
    )
  ) {
    return false;
  }

  try {
    const url = new URL(source);
    const path = url.pathname.toLocaleLowerCase();
    return (
      /\.(?:avif|gif|jpe?g|png|webp)$/.test(path) ||
      (url.hostname === "github.com" && path.includes("/assets/")) ||
      url.hostname.endsWith("githubusercontent.com")
    );
  } catch {
    return false;
  }
}

export function extractReadmeScreenshots(
  markdown: string,
  owner: string,
  name: string,
  readmePath: string,
): string[] {
  const candidates: { source: string; alt: string; index: number }[] = [];
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\((?:<)?([^\s)>]+)(?:>)?(?:\s+["'][^"']*["'])?\)/g)) {
    candidates.push({ alt: match[1], source: match[2], index: match.index });
  }
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const alt = match[0].match(/\balt=["']([^"']*)["']/i)?.[1] || "";
    candidates.push({ alt, source: match[1], index: match.index });
  }

  const resolved = candidates
    .sort((left, right) => left.index - right.index)
    .map(({ source, alt }) => ({
      alt,
      source: resolveReadmeAssetUrl(source, owner, name, readmePath),
    }))
    .filter(
      (candidate): candidate is { source: string; alt: string } =>
        Boolean(candidate.source) && isScreenshot(candidate.source || "", candidate.alt),
    )
    .filter((candidate) => {
      const lowered = candidate.source.toLowerCase();
      // Avoid duplicating theme-specific screenshots that GitHub READMEs often
      // provide as separate dark/light variants using gh-*-mode-only ids.
      return !/gh-(dark|light)-mode-only/.test(lowered);
    })
    .map(({ source }) => source);
  return [...new Set(resolved)].slice(0, 6);
}

export async function getGitHubRepositoryReadme(
  owner: string,
  name: string,
): Promise<RepositoryReadme | null> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`,
    {
      headers: githubHeaders(),
      next: { revalidate: 600 },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub README request failed with status ${response.status}`);
  }

  const readme = (await response.json()) as GitHubReadmeApi;
  if (readme.encoding !== "base64") return null;
  const content = Buffer.from(readme.content.replace(/\s/g, ""), "base64").toString(
    "utf8",
  );
  return {
    content,
    path: readme.path,
    htmlUrl: readme.html_url,
    screenshotUrls: extractReadmeScreenshots(
      content,
      owner,
      name,
      readme.path,
    ),
  };
}
