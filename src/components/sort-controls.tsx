import Link from "next/link";

import {
  activityWindows,
  ageWindows,
  countActiveFilters,
  forkFloors,
  licenseFilters,
  sortOptions,
  starFloors,
  type LicenseFilter,
  type RepositoryFilters,
  type RepositorySort,
} from "@/lib/repositories";

function compactFloor(value: number): string {
  return value >= 1_000 ? `${value / 1_000}k` : String(value);
}

export interface FilterChanges extends RepositoryFilters {
  sort?: RepositorySort;
}

const chipClass =
  "shrink-0 whitespace-nowrap rounded-[3px] border border-border px-2 py-1 font-mono text-[11px] tabular-nums text-muted transition-colors hover:border-muted hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background";
const groupClass = "flex shrink-0 items-center gap-1.5";
const groupLabelClass = "mr-1 text-[11px] text-muted";

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={label} className={groupClass}>
      <span className={groupLabelClass}>{label}</span>
      {children}
    </nav>
  );
}

/**
 * Sort tabs, the two headline filters, and a disclosure holding the rest.
 * Everything is a link, so every state has a URL and it works without
 * JavaScript.
 */
export function SortControls({
  sort,
  filters,
  hrefFor,
  sorts = sortOptions.map((option) => option.value),
  showFilters = true,
}: {
  sort: RepositorySort;
  filters: RepositoryFilters;
  hrefFor: (changes: FilterChanges) => string;
  sorts?: RepositorySort[];
  showFilters?: boolean;
}) {
  const visible = sorts.flatMap((value) => {
    const option = sortOptions.find((item) => item.value === value);
    return option ? [option] : [];
  });
  const minStars = filters.minStars ?? 0;
  const minForks = filters.minForks ?? 0;
  const maxAgeDays = filters.maxAgeDays ?? 0;
  const activeWithinDays = filters.activeWithinDays ?? 0;
  const license: LicenseFilter = filters.license ?? "";
  const activeCount = countActiveFilters(filters);
  const extraCount =
    activeCount -
    (minStars > 0 ? 1 : 0) -
    (maxAgeDays > 0 ? 1 : 0);

  const clearAll: FilterChanges = {
    minStars: 0,
    minForks: 0,
    maxAgeDays: 0,
    activeWithinDays: 0,
    license: "",
    hideArchived: false,
    goodFirstIssues: false,
    includeForks: false,
  };

  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Sort repositories"
        className="-mx-4 flex gap-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((option) => (
          <Link
            key={option.value}
            href={hrefFor({ sort: option.value })}
            title={option.description}
            aria-current={sort === option.value ? "page" : undefined}
            className="relative shrink-0 whitespace-nowrap px-1 py-2 text-sm text-muted transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-foreground after:opacity-0 aria-[current=page]:after:opacity-100"
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {showFilters ? (
        <div className="flex flex-col gap-2">
          <div className="-mx-4 flex items-center gap-x-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-y-2 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <ChipGroup label="Stars">
              {starFloors.map((floor) => (
                <Link
                  key={floor}
                  href={hrefFor({ minStars: floor })}
                  aria-current={minStars === floor ? "page" : undefined}
                  className={chipClass}
                >
                  {floor === 0 ? "any" : `${compactFloor(floor)}+`}
                </Link>
              ))}
            </ChipGroup>
            <ChipGroup label="Created">
              {ageWindows.map((window) => (
                <Link
                  key={window.days}
                  href={hrefFor({ maxAgeDays: window.days })}
                  aria-current={maxAgeDays === window.days ? "page" : undefined}
                  className={chipClass}
                >
                  {window.days === 0 ? "any" : window.label.toLowerCase()}
                </Link>
              ))}
            </ChipGroup>
            {activeCount > 0 ? (
              <Link
                href={hrefFor(clearAll)}
                className="shrink-0 text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          <details className="group" open={extraCount > 0}>
            <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 text-[11px] text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="transition-transform group-open:rotate-90">›</span>
              More filters
              {extraCount > 0 ? (
                <span className="rounded-[3px] bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background">
                  {extraCount}
                </span>
              ) : null}
            </summary>
            <div className="mt-3 flex flex-col gap-2.5 border-l border-border pl-3">
              <ChipGroup label="Forks">
                {forkFloors.map((floor) => (
                  <Link
                    key={floor}
                    href={hrefFor({ minForks: floor })}
                    aria-current={minForks === floor ? "page" : undefined}
                    className={chipClass}
                  >
                    {floor === 0 ? "any" : `${compactFloor(floor)}+`}
                  </Link>
                ))}
              </ChipGroup>
              <ChipGroup label="Last push">
                {activityWindows.map((window) => (
                  <Link
                    key={window.days}
                    href={hrefFor({ activeWithinDays: window.days })}
                    aria-current={activeWithinDays === window.days ? "page" : undefined}
                    className={chipClass}
                  >
                    {window.days === 0 ? "any" : window.label.toLowerCase()}
                  </Link>
                ))}
              </ChipGroup>
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className={`${groupLabelClass} self-center`}>License</span>
                {licenseFilters.map((option) => (
                  <Link
                    key={option.key || "any"}
                    href={hrefFor({ license: option.key })}
                    aria-current={license === option.key ? "page" : undefined}
                    className={chipClass}
                  >
                    {option.key === "" ? "any" : option.label}
                  </Link>
                ))}
              </div>
              <div className={groupClass}>
                <span className={groupLabelClass}>Only</span>
                <Link
                  href={hrefFor({ hideArchived: !filters.hideArchived })}
                  aria-current={filters.hideArchived ? "page" : undefined}
                  className={chipClass}
                  title="Exclude repositories the owner has archived"
                >
                  not archived
                </Link>
                <Link
                  href={hrefFor({ goodFirstIssues: !filters.goodFirstIssues })}
                  aria-current={filters.goodFirstIssues ? "page" : undefined}
                  className={chipClass}
                  title="Repositories with open good first issues"
                >
                  good first issues
                </Link>
                <Link
                  href={hrefFor({ includeForks: !filters.includeForks })}
                  aria-current={filters.includeForks ? "page" : undefined}
                  className={chipClass}
                  title="GitHub search hides forks unless you ask for them"
                >
                  include forks
                </Link>
              </div>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
