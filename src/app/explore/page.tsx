import type { Metadata } from "next";

import { RepositoryList } from "@/components/repository-list";
import { SortControls } from "@/components/sort-controls";
import { RepositoryFilterRail } from "@/components/topic-navigation";
import { discoveryTopics } from "@/lib/mock-data";
import { getTopicCatalog } from "@/lib/phlox-data";
import { mergeTopicCatalog } from "@/lib/repository-taxonomy";
import { searchRepositories } from "@/lib/repository-service";
import {
  isRepositorySort,
  parseAgeWindow,
  parseStarFloor,
  sortOptions,
  type RepositorySort,
} from "@/lib/repositories";

export const metadata: Metadata = { title: "Explore" };

const commonLanguages = ["Rust", "Go", "TypeScript", "Python", "Nix", "Zig"];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedSort = first(params.sort);
  const sort: RepositorySort = isRepositorySort(requestedSort) ? requestedSort : "rising";
  const topic = first(params.topic);
  const language = first(params.language);
  const query = first(params.q);
  const minStars = parseStarFloor(first(params.stars));
  const maxAgeDays = parseAgeWindow(first(params.age));
  const discoveryQuery = query || (!topic && !language ? "stars:>50" : "");
  const [result, discoveredTopics] = await Promise.all([
    searchRepositories({
      query: discoveryQuery,
      sort,
      topic,
      language,
      filters: { minStars, maxAgeDays },
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

  const hrefFor = (changes: {
    sort?: RepositorySort;
    minStars?: number;
    maxAgeDays?: number;
  }) => {
    const nextSort = changes.sort ?? sort;
    const nextStars = changes.minStars ?? minStars;
    const nextAge = changes.maxAgeDays ?? maxAgeDays;
    const next = new URLSearchParams();
    if (nextSort !== "rising") next.set("sort", nextSort);
    if (topic) next.set("topic", topic);
    if (language) next.set("language", language);
    if (query) next.set("q", query);
    if (nextStars > 0) next.set("stars", String(nextStars));
    if (nextAge > 0) next.set("age", String(nextAge));
    const serialized = next.toString();
    return serialized ? `/explore?${serialized}` : "/explore";
  };

  const sourceLabel =
    result.source === "github"
      ? "Live GitHub data"
      : result.source === "phlox"
        ? "Ranked by Phlox likes, hydrated from GitHub"
        : "Indexed fallback";
  const activeSort = sortOptions.find((option) => option.value === sort);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Explore repositories</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          A discovery feed ranked by growth, activity, community depth, and practical relevance.
        </p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <RepositoryFilterRail
            topics={topics}
            languages={languages}
            topic={topic}
            language={language}
            sort={sort}
            query={query}
            minStars={minStars}
            maxAgeDays={maxAgeDays}
          />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
            <SortControls
              sort={sort}
              minStars={minStars}
              maxAgeDays={maxAgeDays}
              hrefFor={hrefFor}
              sorts={["rising", "trending", "stars", "forks", "likes", "newest", "updated"]}
            />
            <form action="/explore" className="flex gap-2">
              {sort !== "rising" ? <input type="hidden" name="sort" value={sort} /> : null}
              {topic ? <input type="hidden" name="topic" value={topic} /> : null}
              {language ? <input type="hidden" name="language" value={language} /> : null}
              {minStars > 0 ? <input type="hidden" name="stars" value={minStars} /> : null}
              {maxAgeDays > 0 ? <input type="hidden" name="age" value={maxAgeDays} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={query}
                aria-label="Filter repositories"
                placeholder="Filter this feed"
                className="input h-8 w-full px-3 sm:w-48"
              />
            </form>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted">
            <span>
              {repositories.length} repositories
              {activeSort ? <span className="text-faint"> · {activeSort.description.toLowerCase()}</span> : null}
            </span>
            <span className="text-right">{sourceLabel}</span>
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
