import { RepositoryRow } from "@/components/repository-row";
import type { ReactionCounts } from "@/lib/phlox-data";
import type { Repository } from "@/lib/repositories";

export function RepositoryList({
  repositories,
  emptyMessage = "No repositories match these filters.",
  compact = false,
  reactionCounts = {},
}: {
  repositories: Repository[];
  emptyMessage?: string;
  compact?: boolean;
  reactionCounts?: Record<string, ReactionCounts>;
}) {
  if (repositories.length === 0) {
    return (
      <div className="border-y border-border py-14 text-center">
        <p className="text-sm font-medium">Nothing found</p>
        <p className="mt-1 text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {repositories.map((repository, index) => (
        <RepositoryRow
          key={repository.id}
          repository={repository}
          rank={index + 1}
          compact={compact}
          reactionCounts={reactionCounts[repository.fullName.toLocaleLowerCase()]}
        />
      ))}
    </div>
  );
}
