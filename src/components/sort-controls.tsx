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
  const linkClass =
    "shrink-0 text-sm text-muted hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground";
  const chipClass =
    "shrink-0 border border-border px-2 py-1 font-mono text-[11px] tabular-nums text-muted hover:border-muted hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground";

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Sort repositories" className="flex gap-4 overflow-x-auto">
        {visible.map((option) => (
          <Link
            key={option.value}
            href={hrefFor({ sort: option.value })}
            title={option.description}
            aria-current={sort === option.value ? "page" : undefined}
            className={linkClass}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <nav aria-label="Minimum stars" className="flex items-center gap-1.5">
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
          <nav aria-label="Created within" className="flex items-center gap-1.5">
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
        </div>
      ) : null}
    </div>
  );
}
