import {
  parseActivityWindow,
  parseAgeWindow,
  parseFlag,
  parseForkFloor,
  parseLicenseFilter,
  parseStarFloor,
  type RepositoryFilters,
  type RepositorySort,
} from "@/lib/repositories";

export type SearchParamRecord = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

/** URL parameter names, kept in one place so links and forms cannot drift. */
export const filterParams = {
  stars: "stars",
  forks: "forks",
  age: "age",
  active: "active",
  license: "license",
  archived: "archived",
  gfi: "gfi",
  forked: "forked",
} as const;

export function parseRepositoryFilters(params: SearchParamRecord): RepositoryFilters {
  return {
    minStars: parseStarFloor(firstParam(params[filterParams.stars])),
    minForks: parseForkFloor(firstParam(params[filterParams.forks])),
    maxAgeDays: parseAgeWindow(firstParam(params[filterParams.age])),
    activeWithinDays: parseActivityWindow(firstParam(params[filterParams.active])),
    license: parseLicenseFilter(firstParam(params[filterParams.license])),
    // `archived=0` means "hide archived"; absent means GitHub's default (include).
    hideArchived: firstParam(params[filterParams.archived]) === "0",
    goodFirstIssues: parseFlag(firstParam(params[filterParams.gfi])),
    includeForks: parseFlag(firstParam(params[filterParams.forked])),
  };
}

/** Serialize filters back into URL parameters, omitting every default. */
export function writeRepositoryFilters(
  target: URLSearchParams,
  filters: RepositoryFilters,
): URLSearchParams {
  if (filters.minStars) target.set(filterParams.stars, String(filters.minStars));
  if (filters.minForks) target.set(filterParams.forks, String(filters.minForks));
  if (filters.maxAgeDays) target.set(filterParams.age, String(filters.maxAgeDays));
  if (filters.activeWithinDays)
    target.set(filterParams.active, String(filters.activeWithinDays));
  if (filters.license) target.set(filterParams.license, filters.license);
  if (filters.hideArchived) target.set(filterParams.archived, "0");
  if (filters.goodFirstIssues) target.set(filterParams.gfi, "1");
  if (filters.includeForks) target.set(filterParams.forked, "1");
  return target;
}

/**
 * Build a link that changes some of the current sort/filter state and keeps
 * the rest. `undefined` in `changes` means "leave as is", so a caller can flip
 * one chip without restating everything.
 */
export function buildFilterHref({
  pathname,
  sort,
  defaultSort,
  filters,
  base = {},
  changes = {},
}: {
  pathname: string;
  sort: RepositorySort;
  defaultSort: RepositorySort;
  filters: RepositoryFilters;
  /** Non-filter parameters to carry through, e.g. topic, language, q. */
  base?: Record<string, string | undefined>;
  changes?: Partial<RepositoryFilters> & { sort?: RepositorySort };
}): string {
  const { sort: nextSort, ...filterChanges } = changes;
  const merged: RepositoryFilters = { ...filters, ...filterChanges };
  const next = new URLSearchParams();

  const effectiveSort = nextSort ?? sort;
  if (effectiveSort !== defaultSort) next.set("sort", effectiveSort);
  for (const [key, value] of Object.entries(base)) {
    if (value) next.set(key, value);
  }
  writeRepositoryFilters(next, merged);

  const serialized = next.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
