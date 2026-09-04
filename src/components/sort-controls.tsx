import Link from "next/link";

import {
  ageWindows,
  sortOptions,
  starFloors,
  type RepositorySort,
} from "@/lib/repositories";

function compactStars(value: number): string {
  return value >= 1_000 ? `${value / 1_000}k` : String(value);
}

/**
 * Sort tabs plus star-floor and age filters. Pure links, so it works without
 * JavaScript and every state has a URL.
 */
export function SortControls({
  sort,
  minStars,
  maxAgeDays,
  hrefFor,
  sorts = sortOptions.map((option) => option.value),
  showFilters = true,
}: {
  sort: RepositorySort;
  minStars: number;
  maxAgeDays: number;
  hrefFor: (changes: {
    sort?: RepositorySort;
    minStars?: number;
    maxAgeDays?: number;
  }) => string;
  sorts?: RepositorySort[];
  showFilters?: boolean;
}) {
  const visible = sorts.flatMap((value) => {
    const option = sortOptions.find((item) => item.value === value);
    return option ? [option] : [];
  });
  const active = visible.find((option) => option.value === sort);
  const tabClass =
    "relative shrink-0 whitespace-nowrap px-1 py-2 text-sm text-muted transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-foreground after:opacity-0 aria-[current=page]:after:opacity-100";
  const chipClass =
    "shrink-0 whitespace-nowrap rounded-[3px] border border-border px-2 py-1 font-mono text-[11px] tabular-nums text-muted transition-colors hover:border-muted hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background";
  const filtersActive = minStars > 0 || maxAgeDays > 0;

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
            className={tabClass}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      {showFilters ? (
        <div className="-mx-4 flex items-center gap-x-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-y-2 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <nav aria-label="Minimum stars" className="flex shrink-0 items-center gap-1.5">
            <span className="mr-1 text-[11px] text-muted">Stars</span>
            {starFloors.map((floor) => (
              <Link
                key={floor}
                href={hrefFor({ minStars: floor })}
                aria-current={minStars === floor ? "page" : undefined}
                className={chipClass}
              >
                {floor === 0 ? "any" : `${compactStars(floor)}+`}
              </Link>
            ))}
          </nav>
          <nav aria-label="Created within" className="flex shrink-0 items-center gap-1.5">
            <span className="mr-1 text-[11px] text-muted">Created</span>
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
          </nav>
          {filtersActive ? (
            <Link
              href={hrefFor({ minStars: 0, maxAgeDays: 0 })}
              className="shrink-0 text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear
            </Link>
          ) : null}
          {active ? (
            <span className="ml-auto hidden shrink-0 text-[11px] text-faint sm:inline">
              {active.description}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
