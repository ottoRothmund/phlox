import {
  ArrowUpRight,
  GitFork,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { RepositoryReaction } from "@/components/repository-reaction";
import { SaveRepositoryButton } from "@/components/save-repository-button";
import type { ReactionCounts } from "@/lib/phlox-data";
import { topicLabel } from "@/lib/phlox-data";
import { languageColor, licenseLabel } from "@/lib/repository-taxonomy";
import type { Repository } from "@/lib/repositories";

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function relativeAge(iso: string, now = Date.now()): string {
  const days = Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
  if (days < 1) return "today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function RepositoryRow({
  repository,
  rank,
  compact = false,
  reactionCounts,
}: {
  repository: Repository;
  rank?: number;
  compact?: boolean;
  reactionCounts?: ReactionCounts;
}) {
  const license = licenseLabel(repository.license);
  const avatar = repository.avatarUrl ?? `https://github.com/${repository.owner}.png?size=80`;

  return (
    <article className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-border py-4 first:border-t sm:py-5 lg:grid-cols-[36px_auto_minmax(0,1fr)_300px] lg:gap-x-4">
      <div className="hidden pt-1 font-mono text-xs tabular-nums text-faint lg:block">
        {rank ? `#${rank}` : ""}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote GitHub avatars, sized by the CDN */}
      <img
        src={avatar}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        className="mt-0.5 h-9 w-9 shrink-0 rounded-[6px] border border-border bg-subtle object-cover sm:h-10 sm:w-10"
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href={`/repo/${repository.owner}/${repository.name}`}
            aria-label={`${repository.fullName} repository details`}
            className="group/title min-w-0 hover:text-muted"
          >
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[17px] font-semibold leading-5 tracking-[-0.02em]">
                {repository.name}
              </span>
              <span className="hidden truncate text-xs text-muted sm:inline">
                {repository.owner}
              </span>
              <ArrowUpRight
                size={13}
                className="shrink-0 self-center opacity-0 transition-opacity group-hover/title:opacity-100"
              />
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted sm:hidden">
              {repository.owner}
            </span>
          </Link>
          {repository.isVerified ? (
            <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
              Verified
            </span>
          ) : null}
        </div>
        <p className={`mt-1.5 max-w-3xl text-sm leading-5 text-muted ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
          {repository.description}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <span
            className="font-medium"
            style={{ color: languageColor(repository.language) }}
          >
            {repository.language}
          </span>
          {license ? <span>{license}</span> : null}
          <span className="text-faint" title={`Created ${repository.createdAt.slice(0, 10)}`}>
            {relativeAge(repository.createdAt)} old
          </span>
          {repository.topics.slice(0, compact ? 2 : 3).map((topic) => (
            <Link key={topic} href={`/explore?topic=${topic}`} className="hover:text-foreground">
              {topicLabel(topic)}
            </Link>
          ))}
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-3 lg:col-span-1 lg:justify-end">
        <div className="flex items-center gap-3 font-mono text-xs tabular-nums lg:flex-col lg:items-end lg:gap-1">
          <span className="inline-flex items-center gap-1" title={`${repository.stars.toLocaleString("en-US")} stars`}>
            <Star size={13} weight="fill" />
            {compactNumber(repository.stars)}
          </span>
          <span
            className="inline-flex items-center gap-1 text-muted"
            title={`${repository.forks.toLocaleString("en-US")} forks`}
          >
            <GitFork size={13} />
            {compactNumber(repository.forks)}
          </span>
          {!repository.growthEstimated && repository.starDelta7d > 0 ? (
            <span className="text-[11px] text-positive" title="Stars gained in the last week">
              +{compactNumber(repository.starDelta7d)}
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <RepositoryReaction
            fullName={repository.fullName}
            initialCounts={reactionCounts}
            compact
          />
          <SaveRepositoryButton repository={repository} />
        </div>
      </div>
    </article>
  );
}
