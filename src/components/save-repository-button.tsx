"use client";

import { BookmarkSimple, Check, Plus } from "@phosphor-icons/react";
import Link from "next/link";

import { useCollections } from "@/components/collections-provider";
import type { Repository } from "@/lib/repositories";

export function SaveRepositoryButton({
  repository,
  onToggle,
  menuSide = "right",
  className = "button-secondary h-8 px-2.5",
}: {
  repository: Repository;
  /** Fires after a collection toggle; `added` is true when the repo was saved. */
  onToggle?: (added: boolean) => void;
  menuSide?: "right" | "left";
  className?: string;
}) {
  const { collections, isSaved, toggleRepository } = useCollections();
  const { fullName } = repository;
  const saved = isSaved(fullName);

  return (
    <details className="save-menu relative">
      <summary
        aria-label={`Save ${fullName} to a collection`}
        className={`${className} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}
      >
        <BookmarkSimple size={15} weight={saved ? "fill" : "regular"} />
        <span>{saved ? "Saved" : "Save"}</span>
      </summary>
      <div
        className={`absolute top-10 z-30 w-64 max-w-[min(16rem,calc(100vw-2rem))] border border-border bg-surface p-1.5 shadow-[0_16px_40px_rgba(20,20,20,0.14)] ${menuSide === "right" ? "right-0" : "left-0"}`}
      >
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Add to collection
        </div>
        {collections.map((collection) => {
          const selected = collection.repoFullNames.includes(fullName);
          return (
            <button
              key={collection.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-[3px] px-2 py-2 text-left text-sm hover:bg-subtle"
              onClick={() => {
                toggleRepository(collection.id, repository);
                onToggle?.(!selected);
              }}
            >
              <span className="truncate">{collection.name}</span>
              {selected ? <Check size={15} weight="bold" /> : null}
            </button>
          );
        })}
        <Link
          href="/collections"
          className="mt-1 flex items-center gap-2 border-t border-border px-2 py-2 text-sm text-muted hover:text-foreground"
        >
          <Plus size={14} />
          New collection
        </Link>
      </div>
    </details>
  );
}
