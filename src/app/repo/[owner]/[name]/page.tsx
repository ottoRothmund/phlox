import {
  ArrowSquareOut,
  CalendarBlank,
  GitFork,
  GithubLogo,
  Star,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RepositoryList } from "@/components/repository-list";
import { RepositoryReadme } from "@/components/repository-readme";
import { RepositoryReaction } from "@/components/repository-reaction";
import { RepositoryReviews } from "@/components/repository-reviews";
import { SaveRepositoryButton } from "@/components/save-repository-button";
import { getGitHubRepositoryReadme } from "@/lib/github";
import {
  getRepositoryReactionCounts,
  getRepositoryReviews,
  topicLabel,
  type ReactionCounts,
} from "@/lib/phlox-data";
import { languageColor } from "@/lib/repository-taxonomy";
import { getRelatedRepositories, getRepository } from "@/lib/repository-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; name: string }>;
}): Promise<Metadata> {
  const { owner, name } = await params;
  const fullName = `${owner}/${name}`;
  const repository = await getRepository(owner, name).catch(() => null);
  const description = repository
    ? `${repository.description} · ${repository.stars.toLocaleString("en-US")} stars · ${repository.language}`
    : `Repository details, README, screenshots, and community notes for ${fullName}.`;
  return {
    title: fullName,
    description,
    openGraph: {
      title: fullName,
      description,
      ...(repository?.avatarUrl ? { images: [repository.avatarUrl] } : {}),
    },
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Rendered per request, never prerendered.
 *
 * This page reads GitHub and Supabase, and Supabase is fetched `no-store`.
 * Whether a route is static is decided at BUILD time, but the secrets that
 * make those fetches run only exist at RUN time — the Docker image is built
 * without `.env.local` (`.dockerignore`). So the build saw no Supabase config,
 * skipped the fetch, and marked the page static; the running container had the
 * config, ran the `no-store` fetch inside a static render, and every repo page
 * outside the prerendered set died with `DYNAMIC_SERVER_USAGE` → 500.
 *
 * A `generateStaticParams` list made it worse: it baked eight repos' HTML from
 * a build with no `GITHUB_TOKEN`, so those pages shipped frozen fallback data
 * while claiming to be live.
 *
 * Freshness still comes from the data layer — `github.ts` fetches carry
 * `next: { revalidate }`. Cache the data, not the page.
 */
export const dynamic = "force-dynamic";

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ owner: string; name: string }>;
}) {
  const { owner, name } = await params;
  const repository = await getRepository(owner, name);
  if (!repository) notFound();

  const githubUrl = repository.htmlUrl || `https://github.com/${repository.fullName}`;
  const [readme, related, reviews] = await Promise.all([
    getGitHubRepositoryReadme(repository.owner, repository.name).catch(() => null),
    getRelatedRepositories(repository, 5).catch(() => []),
    getRepositoryReviews(repository.fullName).catch(() => []),
  ]);
  const reactionCounts = await getRepositoryReactionCounts([
    repository.fullName,
    ...related.map((item) => item.fullName),
  ]).catch((): Record<string, ReactionCounts> => ({}));
  const repositoryCounts =
    reactionCounts[repository.fullName.toLocaleLowerCase()];

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted">
        <Link href="/explore" className="hover:text-foreground">Explore</Link>
        <span>/</span>
        <span>{repository.owner}</span>
        <span>/</span>
        <span className="text-foreground">{repository.name}</span>
      </nav>

      <header className="mt-7 border-b border-border pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <h1 className="break-all text-3xl font-semibold leading-none tracking-[-0.04em] sm:text-4xl">
                  {repository.name}
                </h1>
                <p className="mt-2 text-base text-muted">{repository.owner}</p>
              </div>
              {repository.isVerified ? (
                <span className="border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted">Verified</span>
              ) : null}
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{repository.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span
                className="font-medium"
                style={{ color: languageColor(repository.language) }}
              >
                {repository.language}
              </span>
              <span>{repository.license}</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarBlank size={14} /> Updated {formatDate(repository.updatedAt)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <SaveRepositoryButton repository={repository} />
            <a href={githubUrl} target="_blank" rel="noreferrer" className="button-primary h-8 px-3">
              <GithubLogo size={15} /> View on GitHub <ArrowSquareOut size={13} />
            </a>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        {[
          { label: "Stars", value: repository.stars.toLocaleString("en-US"), icon: Star, positive: false },
          { label: "Forks", value: repository.forks.toLocaleString("en-US"), icon: GitFork, positive: false },
          ...(!repository.growthEstimated
            ? [{
                label: "7-day growth",
                value: `+${repository.starDelta7d.toLocaleString("en-US")}`,
                icon: Star,
                positive: true,
              }]
            : [{
                label: "Watchers",
                value: repository.watchers.toLocaleString("en-US"),
                icon: UsersThree,
                positive: false,
              }]),
          ...(!repository.contributorsEstimated
            ? [{
                label: "Contributors",
                value: repository.contributorCount.toLocaleString("en-US"),
                icon: UsersThree,
                positive: false,
              }]
            : [{
                label: "Open issues",
                value: repository.openIssues.toLocaleString("en-US"),
                icon: GitFork,
                positive: false,
              }]),
        ].map(({ label, value, icon: Icon, positive }) => (
          <div key={label} className="bg-background py-4 pr-3 sm:py-5 [&:nth-child(2n)]:pl-4 lg:[&:nth-child(n+2)]:pl-5 sm:[&:nth-child(2n)]:pl-5">
            <div className="flex items-center gap-2 text-xs text-muted"><Icon size={14} />{label}</div>
            <p className={`mt-1.5 font-mono text-xl font-medium tabular-nums sm:text-2xl ${positive ? "text-positive" : ""}`}>{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div>
            {readme ? (
              <RepositoryReadme
                readme={readme}
                owner={repository.owner}
                name={repository.name}
              />
            ) : (
              <section>
                <h2 className="text-xl font-semibold tracking-[-0.025em]">
                  README
                </h2>
                <p className="mt-3 border-y border-border py-6 text-sm text-muted">
                  GitHub did not return a public README for this repository.
                </p>
              </section>
            )}
          </div>

          <div className="mt-12 border-t border-border pt-10">
            <RepositoryReviews
              fullName={repository.fullName}
              initialReviews={reviews}
            />
          </div>
        </div>

        <aside className="order-1 space-y-8 lg:order-2">
          <section className="border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Community reaction</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Shared Like and Dislike counts from Phlox visitors.
            </p>
            <div className="mt-4">
              <RepositoryReaction
                fullName={repository.fullName}
                initialCounts={repositoryCounts}
              />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold">Repository signals</h2>
            <dl className="mt-3 border-t border-border text-xs">
              {[
                ...(!repository.contributorsEstimated
                  ? [["Open issues", repository.openIssues.toLocaleString("en-US")]]
                  : []),
                ...(!repository.growthEstimated
                  ? [["Watchers", repository.watchers.toLocaleString("en-US")]]
                  : []),
                ["Created", formatDate(repository.createdAt)],
                ["Last push", formatDate(repository.pushedAt)],
                ["License", repository.license],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-border py-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {repository.topics.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold">Topics</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {repository.topics.map((topic) => (
                  <Link
                    key={topic}
                    href={`/explore?topic=${topic}`}
                    className="border border-border bg-surface px-2 py-1 text-xs text-muted hover:bg-subtle hover:text-foreground"
                  >
                    {topicLabel(topic)}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {repository.homepage ? (
            <a href={repository.homepage} target="_blank" rel="noreferrer" className="button-secondary h-9 w-full px-3">
              Project website <ArrowSquareOut size={13} />
            </a>
          ) : null}
        </aside>
      </div>

      <section className="border-t border-border pt-10">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em]">Related repositories</h2>
          <p className="mt-2 text-sm text-muted">Shared topics, language, license, and community signals.</p>
        </div>
        <div className="mt-6">
          <RepositoryList
            repositories={related}
            reactionCounts={reactionCounts}
            compact
          />
        </div>
      </section>
    </div>
  );
}
