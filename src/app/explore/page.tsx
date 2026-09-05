import type { Metadata } from "next";
import Link from "next/link";

import { RepositoryList } from "@/components/repository-list";
import { SortControls } from "@/components/sort-controls";
import { RepositoryFilterRail } from "@/components/topic-navigation";
import { discoveryTopics } from "@/lib/mock-data";
import { getTopicCatalog, topicLabel } from "@/lib/phlox-data";
import { mergeTopicCatalog } from "@/lib/repository-taxonomy";
import { searchRepositories } from "@/lib/repository-service";
import {
  buildFilterHref,
  firstParam,
  parseRepositoryFilters,
  writeRepositoryFilters,
} from "@/lib/search-params";
import { isRepositorySort, type RepositorySort } from "@/lib/repositories";

export const metadata: Metadata = { title: "Explore" };

/**
 * Rendered per request. It already is, because it reads `searchParams` — but
 * that is an implicit consequence, not a promise. Declaring it means a future
 * refactor that stops reading `searchParams` cannot silently make this page
 * prerender in a secret-less container build and 500 at run time.
 * See `repo/[owner]/[name]/page.tsx`.
 */
export const dynamic = "force-dynamic";

const commonLanguages = ["Rust", "Go", "TypeScript", "Python", "Nix", "Zig"];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedSort = firstParam(params.sort);
  const sort: RepositorySort = isRepositorySort(requestedSort) ? requestedSort : "rising";
  const topic = firstParam(params.topic);
  const language = firstParam(params.language);
  const query = firstParam(params.q);
  const filters = parseRepositoryFilters(params);
  const discoveryQuery = query || (!topic && !language ? "stars:>50" : "");
  const [result, discoveredTopics] = await Promise.all([
    searchRepositories({
      query: discoveryQuery,
      sort,
      topic,
      language,
      filters,
      limit: 30,
      preferLive: true,
    }),
    getTopicCatalog(24).catch(() => []),
  ]);
  const repositories = result.repositories;
  const fallbackTopics = discoveryTopics.map((item) => ({
    slug: item.slug,
    label: item.label,
    repositoryCount: item.count,
  }));
  const topics = mergeTopicCatalog(discoveredTopics, fallbackTopics, 24);
  const languages = [
    ...new Set([
      ...(language ? [language] : []),
      ...repositories.map((repository) => repository.language),
      ...commonLanguages,
    ]),
  ].slice(0, 16);

  const hrefFor: Parameters<typeof SortControls>[0]["hrefFor"] = (changes) =>
    buildFilterHref({
      pathname: "/explore",
      sort,
      defaultSort: "rising",
      filters,
      base: { topic, language, q: query },
      changes,
    });

  const sourceLabel =
    result.source === "github"
      ? "live from GitHub"
      : result.source === "phlox"
        ? "ranked by Phlox likes"
        : "indexed fallback";
  const facetHref = (drop: "topic" | "language" | "q") =>
    buildFilterHref({
      pathname: "/explore",
      sort,
      defaultSort: "rising",
      filters,
      base: {
        topic: drop === "topic" ? "" : topic,
        language: drop === "language" ? "" : language,
        q: drop === "q" ? "" : query,
      },
    });
  const activeFacets = [
    ...(topic ? [{ key: "topic", label: topicLabel(topic), clearHref: facetHref("topic") }] : []),
    ...(language ? [{ key: "language", label: language, clearHref: facetHref("language") }] : []),
    ...(query ? [{ key: "q", label: `“${query}”`, clearHref: facetHref("q") }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Explore repositories</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Rank public repositories by growth, stars, forks, age, activity, or what people here liked.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside>
          <RepositoryFilterRail
            topics={topics}
            languages={languages}
            topic={topic}
            language={language}
            sort={sort}
            query={query}
            filters={filters}
          />
        </aside>

        <div className="min-w-0">
          <SortControls
            sort={sort}
            filters={filters}
            hrefFor={hrefFor}
            sorts={["rising", "trending", "stars", "forks", "likes", "newest", "updated"]}
          />
          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted">
            <span className="min-w-0 truncate">
              <span className="font-medium text-foreground">{repositories.length}</span> repositories
              {activeFacets.length > 0 ? (
                <>
                  {" "}in{" "}
                  {activeFacets.map((facet, index) => (
                    <span key={facet.key}>
                      {index > 0 ? " " : ""}
                      <Link
                        href={facet.clearHref}
                        aria-label={`Remove ${facet.label} filter`}
                        title="Remove filter"
                        className="inline-flex items-center gap-1 rounded-[3px] border border-border px-1.5 py-0.5 text-foreground hover:border-muted hover:bg-subtle"
                      >
                        {facet.label}
                        <span aria-hidden="true" className="text-faint">×</span>
                      </Link>
                    </span>
                  ))}
                </>
              ) : null}
              <span className="text-faint"> · {sourceLabel}</span>
            </span>
            <form action="/explore" className="flex shrink-0 gap-2">
              {sort !== "rising" ? <input type="hidden" name="sort" value={sort} /> : null}
              {topic ? <input type="hidden" name="topic" value={topic} /> : null}
              {language ? <input type="hidden" name="language" value={language} /> : null}
              {[...writeRepositoryFilters(new URLSearchParams(), filters)].map(
                ([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ),
              )}
              <input
                type="search"
                name="q"
                defaultValue={query}
                aria-label="Filter repositories"
                placeholder="Filter this feed"
                className="input h-8 w-36 px-3 sm:w-48"
              />
            </form>
          </div>
          <div className="mt-3">
            <RepositoryList
              repositories={repositories}
              reactionCounts={result.reactionCounts}
              emptyMessage={
                sort === "likes"
                  ? "Nothing has been liked yet with these filters. Like a few repositories and they will show up here."
                  : "No repositories match these filters."
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
