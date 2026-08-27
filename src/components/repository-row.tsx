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
import { languageColor } from "@/lib/repository-taxonomy";
import type { Repository } from "@/lib/repositories";

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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
  return (
    <article className="group grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-4 first:border-t sm:py-5 lg:grid-cols-[44px_minmax(0,1fr)_300px]">
      <div className="hidden pt-0.5 font-mono text-xs tabular-nums text-faint lg:block">
        {rank ? String(rank).padStart(2, "0") : ""}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href={`/repo/${repository.owner}/${repository.name}`}
            aria-label={`${repository.fullName} repository details`}
            className="group/title min-w-0 hover:text-muted"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[17px] font-semibold leading-5 tracking-[-0.02em]">
                {repository.name}
              </span>
              <ArrowUpRight
                size={13}
                className="shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100"
              />
            </span>
            <span className="mt-0.5 block truncate text-xs font-normal text-muted">
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
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <span
            className="font-medium"
            style={{ color: languageColor(repository.language) }}
          >
            {repository.language}
          </span>
          <span>{repository.license}</span>
          {repository.topics.slice(0, compact ? 2 : 3).map((topic) => (
            <Link key={topic} href={`/explore?topic=${topic}`} className="hover:text-foreground">
              {topicLabel(topic)}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-start justify-end gap-2 lg:grid lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div className="hidden lg:block">
          <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Star size={13} weight="fill" />
              {compactNumber(repository.stars)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted">
              <GitFork size={13} />
              {compactNumber(repository.forks)}
            </span>
          </div>
          {!repository.growthEstimated ? (
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-positive">
              +{repository.starDelta7d.toLocaleString("en-US")} this week
            </p>
          ) : null}
        </div>
        <RepositoryReaction
          fullName={repository.fullName}
          initialCounts={reactionCounts}
          compact
        />
        <SaveRepositoryButton repository={repository} />
      </div>
    </article>
  );
}
