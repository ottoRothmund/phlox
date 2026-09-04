export type RepositorySort =
  | "relevance"
  | "rising"
  | "trending"
  | "stars"
  | "forks"
  | "likes"
  | "newest"
  | "updated";

export const MAX_SEARCH_QUERY_LENGTH = 240;

export interface SortOption {
  value: RepositorySort;
  label: string;
  description: string;
}

/**
 * Every sort the interface offers, in display order. Pages and the JSON API
 * read from this list so a new sort only has to be added once.
 */
export const sortOptions: SortOption[] = [
  { value: "rising", label: "Rising", description: "Weekly growth relative to size" },
  { value: "trending", label: "Trending", description: "Absolute weekly growth, size-dampened" },
  { value: "stars", label: "Most starred", description: "Total stars" },
  { value: "forks", label: "Most forked", description: "Total forks" },
  { value: "likes", label: "Most liked", description: "Phlox likes, then net score" },
  { value: "newest", label: "Newest", description: "Repository creation date" },
  { value: "updated", label: "Recently active", description: "Last push" },
  { value: "relevance", label: "Best match", description: "GitHub's own ranking" },
];

export function isRepositorySort(value: unknown): value is RepositorySort {
  return sortOptions.some((option) => option.value === value);
}

/** Star floors offered as a filter. 0 means no floor. */
export const starFloors = [0, 100, 1_000, 10_000] as const;

/** Creation-age windows offered as a filter, in days. 0 means any age. */
export const ageWindows = [
  { days: 0, label: "Any age" },
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 365, label: "This year" },
] as const;

export interface RepositoryFilters {
  /** Keep repositories with at least this many stars. */
  minStars?: number;
  /** Keep repositories created within the last N days. */
  maxAgeDays?: number;
}

export function parseStarFloor(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return starFloors.includes(parsed as (typeof starFloors)[number]) ? parsed : 0;
}

export function parseAgeWindow(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return ageWindows.some((window) => window.days === parsed) ? parsed : 0;
}

export function applyRepositoryFilters(
  repositories: Repository[],
  filters: RepositoryFilters,
  now = Date.now(),
): Repository[] {
  const minStars = filters.minStars ?? 0;
  const maxAgeDays = filters.maxAgeDays ?? 0;
  if (minStars <= 0 && maxAgeDays <= 0) return repositories;

  const oldestAllowed = now - maxAgeDays * 86_400_000;
  return repositories.filter(
    (repository) =>
      repository.stars >= minStars &&
      (maxAgeDays <= 0 || Date.parse(repository.createdAt) >= oldestAllowed),
  );
}

export interface LikeCounts {
  likes: number;
  dislikes: number;
}

export interface SortContext {
  /** Reaction totals keyed by lower-cased full name. Required for "likes". */
  reactionCounts?: Record<string, LikeCounts>;
}

export interface Repository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string;
  license: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  starDelta7d: number;
  contributorCount: number;
  growthEstimated?: boolean;
  contributorsEstimated?: boolean;
  isVerified: boolean;
  homepage?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

/**
 * Above this size a repository is treated as "already found": it gets
 * quadratically demoted in the Rising feed no matter how many absolute
 * stars it adds, because a discovery feed listing freeCodeCamp is noise.
 */
const MEGA_REPOSITORY_STARS = 50_000;

/**
 * Bayesian prior added to a repository's prior size when computing relative
 * velocity, so near-zero-star repositories cannot post absurd growth ratios.
 */
const STAR_PRIOR = 50;

/**
 * Rising ranks by relative velocity: weekly growth as a fraction of the
 * repository's prior size. Two dampeners keep it honest — a Bayesian size
 * prior in the denominator so a 9-star repo gaining 8 stars does not post
 * an 800% week, and a confidence factor on small absolute deltas. The
 * mega-repository demotion keeps giants from winning on volume.
 */
function risingScore(repository: Repository): number {
  const previousStars = Math.max(repository.stars - repository.starDelta7d, 1);
  const relativeVelocity =
    repository.starDelta7d / (previousStars + STAR_PRIOR);
  const signalConfidence =
    repository.starDelta7d / (repository.starDelta7d + 30);
  const megaDemotion =
    1 / (1 + (repository.stars / MEGA_REPOSITORY_STARS) ** 2);
  return relativeVelocity * signalConfidence * megaDemotion;
}

/**
 * Trending allows size back in: absolute weekly growth dampened by sqrt
 * of prior size. Large repositories can rank here, just not for free.
 */
function trendingScore(repository: Repository): number {
  const previousStars = Math.max(repository.stars - repository.starDelta7d, 1);
  return repository.starDelta7d / Math.sqrt(previousStars);
}

export function filterRepositories(
  repositories: Repository[],
  query: string,
): Repository[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) return repositories;

  return repositories.filter((repository) => {
    const searchable = [
      repository.fullName,
      repository.description,
      repository.language,
      repository.license,
      ...repository.topics,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

export function sortRepositories(
  repositories: Repository[],
  sort: RepositorySort,
  context: SortContext = {},
): Repository[] {
  if (sort === "relevance") return [...repositories];

  const counts = context.reactionCounts ?? {};
  const likesFor = (repository: Repository): LikeCounts =>
    counts[repository.fullName.toLocaleLowerCase()] ?? { likes: 0, dislikes: 0 };

  return [...repositories].sort((a, b) => {
    switch (sort) {
      case "stars":
        return b.stars - a.stars;
      case "forks":
        return b.forks - a.forks;
      case "likes": {
        const left = likesFor(a);
        const right = likesFor(b);
        // Likes first; a repo with 5 likes and 4 dislikes still outranks one
        // with 1 like and 0 dislikes because more people bothered. Net score
        // breaks ties, then stars so unrated repos have a stable order.
        return (
          right.likes - left.likes ||
          right.likes - right.dislikes - (left.likes - left.dislikes) ||
          b.stars - a.stars
        );
      }
      case "newest":
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      case "updated":
        return Date.parse(b.pushedAt) - Date.parse(a.pushedAt);
      case "trending":
        return trendingScore(b) - trendingScore(a);
      case "rising":
      default:
        return risingScore(b) - risingScore(a);
    }
  });
}

export function findRelatedRepositories(
  repository: Repository,
  candidates: Repository[],
  limit = 4,
): Repository[] {
  const sourceTopics = new Set(repository.topics);

  return candidates
    .filter((candidate) => candidate.id !== repository.id)
    .map((candidate) => {
      const sharedTopics = candidate.topics.filter((topic) =>
        sourceTopics.has(topic),
      ).length;
      const score =
        sharedTopics * 3 +
        (candidate.language === repository.language ? 2 : 0) +
        (candidate.license === repository.license ? 0.5 : 0) +
        Math.min(Math.log10(candidate.stars + 1) / 10, 0.5);
      return { candidate, score };
    })
    .filter(({ score }) => score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
