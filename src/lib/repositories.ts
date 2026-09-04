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
export const starFloors = [0, 100, 1_000, 10_000, 50_000] as const;

/** Fork floors offered as a filter. 0 means no floor. */
export const forkFloors = [0, 10, 100, 1_000] as const;

/** Creation-age windows offered as a filter, in days. 0 means any age. */
export const ageWindows = [
  { days: 0, label: "Any age" },
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 365, label: "This year" },
  { days: 1_095, label: "3 years" },
] as const;

/** Last-push windows offered as a filter, in days. 0 means any. */
export const activityWindows = [
  { days: 0, label: "Any time" },
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 365, label: "This year" },
] as const;

/**
 * Licenses offered as a filter. `key` is what appears in the URL, `qualifier`
 * is GitHub's SPDX-ish key for the `license:` search qualifier, and `match`
 * decides the local check so a filtered pool stays consistent with the query.
 */
export const licenseFilters = [
  { key: "", label: "Any license", qualifier: "" },
  { key: "mit", label: "MIT", qualifier: "mit" },
  { key: "apache-2.0", label: "Apache 2.0", qualifier: "apache-2.0" },
  { key: "gpl-3.0", label: "GPL 3.0", qualifier: "gpl-3.0" },
  { key: "agpl-3.0", label: "AGPL 3.0", qualifier: "agpl-3.0" },
  { key: "bsd-3-clause", label: "BSD 3-clause", qualifier: "bsd-3-clause" },
  { key: "mpl-2.0", label: "MPL 2.0", qualifier: "mpl-2.0" },
  { key: "unlicense", label: "Unlicense", qualifier: "unlicense" },
  { key: "none", label: "No license", qualifier: "" },
] as const;

export type LicenseFilter = (typeof licenseFilters)[number]["key"];

export interface RepositoryFilters {
  /** Keep repositories with at least this many stars. */
  minStars?: number;
  /** Keep repositories with at least this many forks. */
  minForks?: number;
  /** Keep repositories created within the last N days. */
  maxAgeDays?: number;
  /** Keep repositories pushed to within the last N days. */
  activeWithinDays?: number;
  /** Keep repositories under this license key, or unlicensed for "none". */
  license?: LicenseFilter;
  /** Drop archived repositories. */
  hideArchived?: boolean;
  /** Keep only repositories with open "good first issue" labels. */
  goodFirstIssues?: boolean;
  /** Include forks. GitHub search excludes them by default. */
  includeForks?: boolean;
}

export function parseStarFloor(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return starFloors.includes(parsed as (typeof starFloors)[number]) ? parsed : 0;
}

export function parseForkFloor(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return forkFloors.includes(parsed as (typeof forkFloors)[number]) ? parsed : 0;
}

export function parseAgeWindow(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return ageWindows.some((window) => window.days === parsed) ? parsed : 0;
}

export function parseActivityWindow(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return activityWindows.some((window) => window.days === parsed) ? parsed : 0;
}

export function parseLicenseFilter(value: string | undefined): LicenseFilter {
  const normalized = (value ?? "").trim().toLocaleLowerCase();
  const match = licenseFilters.find((option) => option.key === normalized);
  return match ? match.key : "";
}

export function parseFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** True when the repository carries no usable license metadata. */
function unlicensed(repository: Repository): boolean {
  const license = repository.license.trim();
  return !license || /^(not specified|noassertion)$/i.test(license);
}

function licenseMatches(repository: Repository, license: LicenseFilter): boolean {
  if (!license) return true;
  if (license === "none") return unlicensed(repository);
  if (unlicensed(repository)) return false;
  return repository.license.trim().toLocaleLowerCase() === license;
}

/** Count of filters the visitor has actually set, for the "More filters" badge. */
export function countActiveFilters(filters: RepositoryFilters): number {
  return [
    (filters.minStars ?? 0) > 0,
    (filters.minForks ?? 0) > 0,
    (filters.maxAgeDays ?? 0) > 0,
    (filters.activeWithinDays ?? 0) > 0,
    Boolean(filters.license),
    Boolean(filters.hideArchived),
    Boolean(filters.goodFirstIssues),
    Boolean(filters.includeForks),
  ].filter(Boolean).length;
}

/**
 * Local pass over a result pool. Every filter here is also pushed to GitHub as
 * a search qualifier where one exists; this pass keeps the indexed fallback and
 * any locally reranked pool honest.
 */
export function applyRepositoryFilters(
  repositories: Repository[],
  filters: RepositoryFilters,
  now = Date.now(),
): Repository[] {
  const minStars = filters.minStars ?? 0;
  const minForks = filters.minForks ?? 0;
  const maxAgeDays = filters.maxAgeDays ?? 0;
  const activeWithinDays = filters.activeWithinDays ?? 0;
  const license = filters.license ?? "";
  if (
    minStars <= 0 &&
    minForks <= 0 &&
    maxAgeDays <= 0 &&
    activeWithinDays <= 0 &&
    !license
  ) {
    return repositories;
  }

  const createdAfter = now - maxAgeDays * 86_400_000;
  const pushedAfter = now - activeWithinDays * 86_400_000;
  return repositories.filter(
    (repository) =>
      repository.stars >= minStars &&
      repository.forks >= minForks &&
      (maxAgeDays <= 0 || Date.parse(repository.createdAt) >= createdAfter) &&
      (activeWithinDays <= 0 || Date.parse(repository.pushedAt) >= pushedAfter) &&
      licenseMatches(repository, license),
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
