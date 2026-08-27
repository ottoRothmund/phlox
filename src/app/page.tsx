import {
  ArrowRight,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { RepositoryList } from "@/components/repository-list";
import { TopicBrowse } from "@/components/topic-navigation";
import { discoveryTopics, queryMockRepositories } from "@/lib/mock-data";
import {
  getRepositoryReactionCounts,
  getTopicCatalog,
} from "@/lib/phlox-data";
import { languageColor, mergeTopicCatalog } from "@/lib/repository-taxonomy";
import { searchRepositories } from "@/lib/repository-service";

export const metadata: Metadata = {
  title: "Discover remarkable repositories",
};

export default async function Home() {
  const [result, discoveredTopics] = await Promise.all([
    searchRepositories({
      query: "stars:>100",
      sort: "rising",
      limit: 12,
      preferLive: true,
    }),
    getTopicCatalog(18).catch(() => []),
  ]);
  const rising = result.repositories;
  const fallbackTopics = discoveryTopics.map((topic) => ({
    slug: topic.slug,
    label: topic.label,
    repositoryCount: topic.count,
  }));
  const browseTopics = mergeTopicCatalog(
    discoveredTopics,
    fallbackTopics,
    18,
  );
  const reactionCounts = await getRepositoryReactionCounts(
    rising.map((repository) => repository.fullName),
  ).catch(() => ({}));
  const underTheRadar = queryMockRepositories({ sort: "rising" })
    .filter((repository) => repository.stars < 10_000)
    .slice(0, 4);
  const topLanguage = rising[0]?.language ?? "";

  return (
    <>
      <section className="homepage-hero border-b border-border bg-surface">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex px-4 py-14 sm:px-6 sm:py-20 lg:min-h-[640px] lg:flex-col lg:justify-center lg:pr-10">
            <div className="w-full">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                Repository discovery
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-[58px]">
                <span className="block">Find the repositories</span>
                <span className="block text-muted">GitHub Explore misses.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                Search by momentum, topic, stack, and similarity. Follow the useful edges of open source.
              </p>
              <form action="/search" className="mt-8 max-w-2xl">
                <label className="relative block">
                  <span className="sr-only">Search GitHub repositories</span>
                  <MagnifyingGlass
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="search"
                    name="q"
                    aria-label="Search GitHub repositories"
                    placeholder="Try: terminal tools in Rust, DeFi infrastructure, Nix alternatives"
                    className="input h-12 w-full pl-11 pr-28 text-sm"
                  />
                  <button
                    type="submit"
                    className="button-primary absolute right-1.5 top-1.5 h-9 px-4"
                  >
                    Search
                  </button>
                </label>
              </form>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                <span>Popular searches</span>
                <Link href="/search?q=self-hosted+photos" className="hover:text-foreground">
                  self-hosted photos
                </Link>
                <Link href="/search?q=terminal+file+manager" className="hover:text-foreground">
                  terminal file manager
                </Link>
                <Link href="/search?q=ethereum+rust" className="hover:text-foreground">
                  ethereum rust
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs text-muted sm:px-6">
          <span className="font-mono">
            <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-positive" />
            live from GitHub
          </span>
          {topLanguage ? (
            <span>
              leading language <span style={{ color: languageColor(topLanguage) }}>{topLanguage}</span>
            </span>
          ) : null}
          <span>{browseTopics.length} topics indexed</span>
          <span className="ml-auto hidden sm:block">updated continuously · public repositories only</span>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <TopicBrowse topics={browseTopics} />
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Fast-growing repositories</h2>
                <p className="mt-2 text-sm text-muted">Sorted by recent star growth and repository activity.</p>
              </div>
              <Link href="/explore" className="hidden items-center gap-1 text-sm font-medium sm:flex">
                Explore all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-7">
              <RepositoryList
                repositories={rising.slice(0, 8)}
                reactionCounts={reactionCounts}
              />
            </div>
          </div>

          <aside className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold">Under 10k stars</h2>
              <p className="mt-1 text-xs leading-5 text-muted">Smaller projects with disproportionate weekly growth.</p>
              <div className="mt-4 border-t border-border">
                {underTheRadar.map((repository) => (
                  <Link
                    key={repository.id}
                    href={`/repo/${repository.owner}/${repository.name}`}
                    className="block border-b border-border py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {repository.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {repository.owner}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-positive">+{repository.starDelta7d}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">{repository.description}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Search beyond stars</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Phlox combines GitHub metadata with growth and similarity signals, then keeps the source link one click away.
              </p>
              <Link href="/search" className="button-secondary mt-5 h-9 px-3">
                Open advanced search
              </Link>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}