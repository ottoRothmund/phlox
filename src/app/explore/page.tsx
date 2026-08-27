import type { Metadata } from "next";
import Link from "next/link";

import { RepositoryList } from "@/components/repository-list";
import { RepositoryFilterRail } from "@/components/topic-navigation";
import { discoveryTopics } from "@/lib/mock-data";
import {
  getRepositoryReactionCounts,
  getTopicCatalog,
} from "@/lib/phlox-data";
import { mergeTopicCatalog } from "@/lib/repository-taxonomy";
import { searchRepositories } from "@/lib/repository-service";
import type { RepositorySort } from "@/lib/repositories";

export const metadata: Metadata = { title: "Explore" };

const sorts: { value: RepositorySort; label: string }[] = [
  { value: "rising", label: "Rising" },
  { value: "trending", label: "Trending" },
  { value: "stars", label: "Most starred" },
  { value: "updated", label: "Recently active" },
];

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
  const requestedSort = first(params.sort) as RepositorySort;
  const sort = sorts.some((item) => item.value === requestedSort)
    ? requestedSort
    : "rising";
  const topic = first(params.topic);
  const language = first(params.language);
  const query = first(params.q);
  const discoveryQuery = query || (!topic && !language ? "stars:>50" : "");
  const [result, discoveredTopics] = await Promise.all([
    searchRepositories({
      query: discoveryQuery,
      sort,
      topic,
      language,
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
  const reactionCounts = await getRepositoryReactionCounts(
    repositories.map((repository) => repository.fullName),
  ).catch(() => ({}));

  const filterHref = (key: string, value: string) => {
    const next = new URLSearchParams();
    if (sort !== "rising") next.set("sort", sort);
    if (topic && key !== "topic") next.set("topic", topic);
    if (language && key !== "language") next.set("language", language);
    if (query) next.set("q", query);
    if (value) next.set(key, value);
    return `/explore?${next.toString()}`;
  };

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
          />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Sort repositories" className="flex gap-4 overflow-x-auto">
              {sorts.map((item) => (
                <Link
                  key={item.value}
                  href={filterHref("sort", item.value)}
                  aria-current={sort === item.value ? "page" : undefined}
                  className="shrink-0 text-sm text-muted hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action="/explore" className="flex gap-2">
              {sort !== "rising" ? <input type="hidden" name="sort" value={sort} /> : null}
              {topic ? <input type="hidden" name="topic" value={topic} /> : null}
              {language ? <input type="hidden" name="language" value={language} /> : null}
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
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>{repositories.length} repositories</span>
            <span>{result.source === "github" ? "Live GitHub data" : "Indexed fallback"}</span>
          </div>
          <div className="mt-3">
            <RepositoryList
              repositories={repositories}
              reactionCounts={reactionCounts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
