"use client";

import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { getBrowserVisitorId } from "@/lib/browser-identity";
import type { ReactionCounts } from "@/lib/phlox-data";

export type RepositoryReactionValue = "like" | "dislike";

const emptyReactionCounts: ReactionCounts = { likes: 0, dislikes: 0 };

export function RepositoryReaction({
  fullName,
  compact = false,
  initialCounts = emptyReactionCounts,
}: {
  fullName: string;
  compact?: boolean;
  initialCounts?: ReactionCounts;
}) {
  const storageKey = `phlox.reaction.${fullName}`;
  const [reaction, setReaction] = useState<RepositoryReactionValue | null>(null);
  const [counts, setCounts] = useState(initialCounts);
  const interactionVersion = useRef(0);

  useEffect(() => {
    const hydrationVersion = interactionVersion.current;
    let storedReaction: RepositoryReactionValue | null = null;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "like" || stored === "dislike") {
        storedReaction = stored;
      }
    } catch {
      // Unavailable storage hydrates to no reaction.
    }

    const timer = window.setTimeout(() => {
      if (interactionVersion.current === hydrationVersion) {
        setReaction(storedReaction);
        setCounts(initialCounts);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialCounts, storageKey]);

  function adjustedCounts(
    current: RepositoryReactionValue | null,
    next: RepositoryReactionValue | null,
  ): ReactionCounts {
    const adjusted = { ...counts };
    if (current === "like") adjusted.likes = Math.max(0, adjusted.likes - 1);
    if (current === "dislike") adjusted.dislikes = Math.max(0, adjusted.dislikes - 1);
    if (next === "like") adjusted.likes += 1;
    if (next === "dislike") adjusted.dislikes += 1;
    return adjusted;
  }


  function toggleReaction(value: RepositoryReactionValue) {
    interactionVersion.current += 1;
    const requestVersion = interactionVersion.current;
    const nextReaction = reaction === value ? null : value;
    setCounts(adjustedCounts(reaction, nextReaction));
    setReaction(nextReaction);

    try {
      if (nextReaction) {
        window.localStorage.setItem(storageKey, nextReaction);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Keep the in-memory reaction when storage is unavailable.
    }

    void fetch("/api/repositories/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        visitorId: getBrowserVisitorId(),
        reaction: nextReaction,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reaction update failed.");
        return (await response.json()) as ReactionCounts & {
          reaction: RepositoryReactionValue | null;
        };
      })
      .then((result) => {
        if (interactionVersion.current !== requestVersion) return;
        setCounts({ likes: result.likes, dislikes: result.dislikes });
        setReaction(result.reaction);
      })
      .catch(() => {
        // The optimistic local reaction remains usable while sharing is offline.
      });
  }

  return (
    <div
      role="group"
      aria-label={`React to ${fullName}`}
      className="inline-flex items-center gap-px border border-border bg-border"
    >
      {(
        [
          { value: "like", label: "Like", Icon: ThumbsUp },
          { value: "dislike", label: "Dislike", Icon: ThumbsDown },
        ] as const
      ).map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} ${fullName}`}
          aria-pressed={reaction === value}
          className={`inline-flex h-8 items-center justify-center gap-1.5 bg-surface px-2 text-xs text-muted hover:bg-subtle hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background ${compact ? "min-w-12 px-1.5" : "min-w-20"}`}
          onClick={() => toggleReaction(value)}
        >
          <Icon size={15} weight={reaction === value ? "fill" : "regular"} />
          <span className={compact ? "sr-only" : undefined}>{label}</span>
          {(value === "like" ? counts.likes : counts.dislikes) > 0 ? (
            <span className="font-mono tabular-nums">
              {value === "like" ? counts.likes : counts.dislikes}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
