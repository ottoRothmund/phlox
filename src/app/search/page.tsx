import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { RepositoryList } from "@/components/repository-list";
import { SortControls } from "@/components/sort-controls";
import { searchRepositories } from "@/lib/repository-service";
import {
  buildFilterHref,
  firstParam,
  parseRepositoryFilters,
  writeRepositoryFilters,
} from "@/lib/search-params";
import {
  MAX_SEARCH_QUERY_LENGTH,
  isRepositorySort,
  type RepositorySort,
} from "@/lib/repositories";

export const metadata: Metadata = { title: "Search" };

/**
 * Rendered per request. It already is, because it reads `searchParams` — but
 * that is an implicit consequence, not a promise. Declaring it means a future
 * refactor that stops reading `searchParams` cannot silently make this page
 * prerender in a secret-less container build and 500 at run time.
 * See `repo/[owner]/[name]/page.tsx`.
 */
export const dynamic = "force-dynamic";

const searchSorts: RepositorySort[] = [
  "relevance",
  "rising",
  "stars",
  "forks",
  "likes",
  "newest",
  "updated",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q).trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const requestedSort = firstParam(params.sort);
  const sort: RepositorySort =
    isRepositorySort(requestedSort) && searchSorts.includes(requestedSort)
      ? requestedSort
      : "relevance";
  const filters = parseRepositoryFilters(params);
  const result = await searchRepositories({
    query,
    sort,
    filters,
    preferLive: Boolean(query) || sort === "likes",
  });

  const hrefFor: Parameters<typeof SortControls>[0]["hrefFor"] = (changes) =>
    buildFilterHref({
      pathname: "/search",
      sort,
      defaultSort: "relevance",
      filters,
      base: { q: query },
      changes,
    });

  const heading = query
    ? `Results for “${query}”`
    : sort === "likes" && result.source === "phlox"
      ? "Most liked on Phlox"
      : "Popular in the index";
  const sourceLabel =
    result.source === "github"
      ? "GitHub"
      : result.source === "phlox"
        ? "Phlox reactions"
        : "the Phlox index";

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">Search repositories</h1>
        <p className="mt-2 text-sm text-muted">
          Query GitHub directly, with an indexed fallback when the public API is unavailable.
        </p>
      </div>

      <form action="/search" className="mt-8">
        <label className="relative block">
          <span className="sr-only">Repository search query</span>
          <MagnifyingGlass
            size={19}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          {sort !== "relevance" ? <input type="hidden" name="sort" value={sort} /> : null}
          {[...writeRepositoryFilters(new URLSearchParams(), filters)].map(
            ([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ),
          )}
          <input
            type="search"
            name="q"
            maxLength={MAX_SEARCH_QUERY_LENGTH}
            defaultValue={query}
            aria-label="Repository search query"
            placeholder="Search by project, topic, language, or problem"
            className="input h-12 w-full pl-12 pr-28 text-sm"
            autoFocus={!query}
          />
          <button type="submit" className="button-primary absolute right-1.5 top-1.5 h-9 px-4">
            Search
          </button>
        </label>
      </form>

      {!query ? (
        <section className="mt-8 border-y border-border py-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Try a discovery query</h2>
          <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2">
            {[
              "terminal developer tools written in rust",
              "self-hosted photo management",
              "ethereum execution client",
              "linux desktop environment",
            ].map((example) => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}`}
                className="bg-surface px-4 py-3 text-sm hover:bg-subtle"
              >
                {example}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-9 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{heading}</h2>
          <p className="mt-1 text-xs text-muted">
            {result.repositories.length} results from {sourceLabel}
          </p>
        </div>
        <SortControls
          sort={sort}
          filters={filters}
          hrefFor={hrefFor}
          sorts={searchSorts}
        />
      </div>
      <div className="mt-4">
        <RepositoryList
          repositories={result.repositories}
          reactionCounts={result.reactionCounts}
          emptyMessage={
            sort === "likes" && !query
              ? "Nothing has been liked yet. Like a few repositories and they will show up here."
              : "Try fewer terms or search for a broader topic."
          }
        />
      </div>
    </div>
  );
}
