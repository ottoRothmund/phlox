import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { RepositoryList } from "@/components/repository-list";
import { getRepositoryReactionCounts } from "@/lib/phlox-data";
import { searchRepositories } from "@/lib/repository-service";
import {
  MAX_SEARCH_QUERY_LENGTH,
  type RepositorySort,
} from "@/lib/repositories";

export const metadata: Metadata = { title: "Search" };

const sorts: { value: RepositorySort; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "rising", label: "Rising" },
  { value: "updated", label: "Recently active" },
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const requestedSort = first(params.sort) as RepositorySort;
  const sort = sorts.some((item) => item.value === requestedSort)
    ? requestedSort
    : "relevance";
  const result = await searchRepositories({
    query,
    sort,
    preferLive: Boolean(query),
  });
  const reactionCounts = await getRepositoryReactionCounts(
    result.repositories.map((repository) => repository.fullName),
  ).catch(() => ({}));

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

      <div className="mt-9 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {query ? `Results for “${query}”` : "Popular in the index"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {result.repositories.length} results from {result.source === "github" ? "GitHub" : "the Phlox index"}
          </p>
        </div>
        <nav aria-label="Sort search results" className="flex gap-4">
          {sorts.map((item) => {
            const href = `/search?q=${encodeURIComponent(query)}&sort=${item.value}`;
            return (
              <Link
                key={item.value}
                href={href}
                aria-current={sort === item.value ? "page" : undefined}
                className="text-xs text-muted hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-3">
        <RepositoryList
          repositories={result.repositories}
          reactionCounts={reactionCounts}
          emptyMessage="Try fewer terms or search for a broader topic."
        />
      </div>
    </div>
  );
}
