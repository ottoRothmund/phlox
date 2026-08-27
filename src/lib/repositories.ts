export type RepositorySort =
  | "relevance"
  | "rising"
  | "trending"
  | "stars"
  | "updated";

export const MAX_SEARCH_QUERY_LENGTH = 240;

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
): Repository[] {
  if (sort === "relevance") return [...repositories];

  return [...repositories].sort((a, b) => {
    switch (sort) {
      case "stars":
        return b.stars - a.stars;
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
