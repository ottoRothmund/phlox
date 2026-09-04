/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  GitFork,
  Star,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { RepositoryReaction } from "@/components/repository-reaction";
import { SaveRepositoryButton } from "@/components/save-repository-button";
import type { FeedItem, FeedTaste, TasteSignal } from "@/lib/feed";
import { tasteSummary, updateTaste } from "@/lib/feed";
import {
  clearTaste,
  getServerTasteSnapshot,
  getTasteSnapshot,
  readSeen,
  subscribeTaste,
  writeSeen,
  writeTaste,
} from "@/lib/feed-storage";
import type { ReactionCounts } from "@/lib/phlox-data";
import { topicLabel } from "@/lib/phlox-data";
import { languageColor } from "@/lib/repository-taxonomy";

interface FeedPayload {
  items: FeedItem[];
  seed: number;
  source: "github" | "index";
  reactionCounts: Record<string, ReactionCounts>;
}

const PREFETCH_AHEAD = 4;
/** A card scrolled past faster than this never counted as "seen and rejected". */
const SKIP_DWELL_MS = 1200;

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function relativeDays(value: string): string {
  const days = Math.round((Date.now() - Date.parse(value)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/**
 * Rows for the signals list. Estimated fields (growth, contributors) are
 * left out on purpose: showing a guess next to real numbers reads as fact.
 */
function signalRows(repository: FeedItem["repository"]): [string, string][] {
  const rows: [string, string][] = [
    ["Created", formatDate(repository.createdAt)],
    ["Last push", relativeDays(repository.pushedAt)],
    ["Open issues", compactNumber(repository.openIssues)],
  ];
  if (!repository.growthEstimated) {
    rows.unshift(["This week", `+${compactNumber(repository.starDelta7d)}`]);
  }
  if (repository.watchers > 0) rows.push(["Watchers", compactNumber(repository.watchers)]);
  if (repository.forks > 0 && repository.stars > 0) {
    rows.push(["Forks per 100 stars", ((repository.forks / repository.stars) * 100).toFixed(1)]);
  }
  return rows;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ageLabel(createdAt: string): string {
  const days = Math.max(0, (Date.now() - Date.parse(createdAt)) / 86_400_000);
  if (days < 45) return `${Math.max(1, Math.round(days))}d old`;
  if (days < 365) return `${Math.round(days / 30)}mo old`;
  return `${(days / 365).toFixed(days < 730 ? 1 : 0)}y old`;
}

export function DiscoveryFeed({
  initial,
  fetchBatch = defaultFetchBatch,
}: {
  initial?: FeedPayload;
  fetchBatch?: (body: {
    taste: FeedTaste;
    exclude: string[];
  }) => Promise<FeedPayload>;
}) {
  const [items, setItems] = useState<FeedItem[]>(initial?.items ?? []);
  const [reactionCounts, setReactionCounts] = useState(initial?.reactionCounts ?? {});
  const [source, setSource] = useState<"github" | "index" | null>(initial?.source ?? null);
  const taste = useSyncExternalStore(
    subscribeTaste,
    getTasteSnapshot,
    getServerTasteSnapshot,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<string[] | null>(null);
  const reactedRef = useRef(new Set<string>());
  // `at` is 0 until the first card is observed on the client, so a card
  // scrolled past before the observer attaches never counts as a skip.
  const enteredAtRef = useRef<{ index: number; at: number }>({ index: 0, at: 0 });
  const inFlightRef = useRef(false);
  const activeIndexRef = useRef(0);

  const seen = () => {
    if (seenRef.current === null) seenRef.current = readSeen();
    return seenRef.current;
  };

  const loadMore = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const exclude = [
        ...seen(),
        ...items.map((item) => item.repository.fullName),
      ];
      const payload = await fetchBatch({ taste: getTasteSnapshot(), exclude });
      if (!Array.isArray(payload.items)) throw new Error("The feed returned nothing.");
      setItems((current) => {
        const known = new Set(current.map((item) => item.repository.fullName));
        return [
          ...current,
          ...payload.items.filter((item) => !known.has(item.repository.fullName)),
        ];
      });
      setReactionCounts((current) => ({ ...current, ...payload.reactionCounts }));
      setSource(payload.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The feed could not load.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [fetchBatch, items]);

  // The server batch was built without taste (taste lives in the browser).
  // From here on every batch, including a client-side first batch, uses it.
  useEffect(() => {
    if (items.length === 0 && !inFlightRef.current) void loadMore();
  }, [items.length, loadMore]);

  const applySignal = useCallback((item: FeedItem, signal: TasteSignal) => {
    writeTaste(updateTaste(getTasteSnapshot(), item.repository, signal));
  }, []);

  const markSeen = useCallback((item: FeedItem) => {
    const current = seen();
    if (current.includes(item.repository.fullName)) return;
    seenRef.current = [...current, item.repository.fullName];
    writeSeen(seenRef.current);
  }, []);

  // Track which card is on screen. Leaving a card after dwelling on it with
  // no reaction is a soft negative signal; leaving quickly is just scrolling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof IntersectionObserver === "undefined") return;
    const cards = [...scroller.querySelectorAll<HTMLElement>("[data-feed-index]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number(visible.target.getAttribute("data-feed-index"));
        const current = activeIndexRef.current;
        if (current === index) return;
        const previous = items[current];
        const dwell = Date.now() - enteredAtRef.current.at;
        if (
          previous &&
          index > current &&
          enteredAtRef.current.at > 0 &&
          dwell >= SKIP_DWELL_MS &&
          !reactedRef.current.has(previous.repository.fullName)
        ) {
          applySignal(previous, "skip");
        }
        if (previous) markSeen(previous);
        enteredAtRef.current = { index, at: Date.now() };
        activeIndexRef.current = index;
        setActiveIndex(index);
      },
      { root: scroller, threshold: [0.6] },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items, applySignal, markSeen]);

  useEffect(() => {
    if (items.length > 0 && activeIndex >= items.length - PREFETCH_AHEAD) {
      void loadMore();
    }
  }, [activeIndex, items.length, loadMore]);

  const scrollTo = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const target = scroller.querySelector<HTMLElement>(`[data-feed-index="${clamped}"]`);
      if (!target) return;
      // Scroll the feed container only. scrollIntoView would also scroll the
      // document, dragging the footer up under the last card.
      scroller.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    },
    [items.length],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        scrollTo(activeIndex + 1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        scrollTo(activeIndex - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, scrollTo]);

  const reset = () => {
    clearTaste();
    seenRef.current = [];
    reactedRef.current = new Set();
    setItems([]);
    setActiveIndex(0);
    activeIndexRef.current = 0;
    enteredAtRef.current = { index: 0, at: 0 };
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  };

  const tasteLabels = tasteSummary(taste);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 text-xs text-muted sm:px-6">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3">
          <span className="font-mono">
            {source === "github" ? (
              <>
                <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-positive" />
                live
              </>
            ) : source === "index" ? (
              "indexed fallback"
            ) : (
              "loading"
            )}
          </span>
          {tasteLabels.length > 0 ? (
            <span className="hidden min-w-0 truncate sm:block" data-testid="taste-summary">
              learning: {tasteLabels.join(", ")}
            </span>
          ) : (
            <span className="hidden sm:block">react to teach the feed your taste</span>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="font-mono tabular-nums">
            {items.length > 0 ? `${activeIndex + 1} / ${items.length}` : ""}
          </span>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset taste and start over"
            className="button-ghost h-7 px-2 text-xs"
          >
            <ArrowsClockwise size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        data-testid="feed-scroller"
        className="feed-scroller h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {items.map((item, index) => (
          <FeedCard
            key={item.repository.fullName}
            item={item}
            index={index}
            active={index === activeIndex}
            reactionCounts={reactionCounts[item.repository.fullName.toLocaleLowerCase()]}
            onSignal={(signal) => {
              reactedRef.current.add(item.repository.fullName);
              applySignal(item, signal);
            }}
          />
        ))}
        {items.length === 0 ? (
          <div className="flex h-full snap-start items-center justify-center px-6 text-sm text-muted">
            {error ? (
              <div className="text-center">
                <p className="text-foreground">{error}</p>
                <button type="button" onClick={() => void loadMore()} className="button-secondary mt-4 h-9 px-3">
                  Try again
                </button>
              </div>
            ) : (
              "Finding repositories"
            )}
          </div>
        ) : loading || error ? (
          <div className="flex h-24 snap-start items-center justify-center text-xs text-muted">
            {error ? (
              <button type="button" onClick={() => void loadMore()} className="button-secondary h-8 px-3">
                {error} · retry
              </button>
            ) : (
              "Loading more"
            )}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden flex-col gap-1 lg:flex xl:left-6">
        <button
          type="button"
          onClick={() => scrollTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous repository"
          className="button-secondary pointer-events-auto h-9 w-9 disabled:opacity-30"
        >
          <CaretUp size={15} />
        </button>
        <button
          type="button"
          onClick={() => scrollTo(activeIndex + 1)}
          disabled={activeIndex >= items.length - 1}
          aria-label="Next repository"
          className="button-secondary pointer-events-auto h-9 w-9 disabled:opacity-30"
        >
          <CaretDown size={15} />
        </button>
      </div>
    </div>
  );
}

function FeedCard({
  item,
  index,
  active,
  reactionCounts,
  onSignal,
}: {
  item: FeedItem;
  index: number;
  active: boolean;
  reactionCounts?: ReactionCounts;
  onSignal: (signal: TasteSignal) => void;
}) {
  const { repository, visual, reason, lane } = item;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = visual && !imageFailed;
  const githubUrl = repository.htmlUrl || `https://github.com/${repository.fullName}`;
  const detailHref = `/repo/${repository.owner}/${repository.name}`;

  return (
    <article
      data-feed-index={index}
      data-active={active ? "true" : undefined}
      aria-label={`${repository.fullName}, ${reason}`}
      className="grid h-full snap-start snap-always grid-rows-[42%_minmax(0,1fr)] border-b border-border bg-background lg:grid-cols-[minmax(0,1fr)_minmax(360px,32%)] lg:grid-rows-1"
    >
      <div className="relative min-h-0 overflow-hidden border-border bg-surface lg:border-r">
        {showImage ? (
          <img
            src={visual.url}
            alt={`${repository.name} ${visual.kind === "screenshot" ? "screenshot" : "preview"}`}
            loading={index < 2 ? "eager" : "lazy"}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-4 sm:p-8"
          />
        ) : (
          <div className="flex h-full flex-col justify-center p-6 sm:p-10">
            <p className="font-mono text-xs text-faint">{repository.owner}</p>
            <p className="mt-2 break-words text-[clamp(2rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
              {repository.name}
            </p>
            <p className="mt-6 max-w-2xl text-base leading-6 text-muted sm:text-lg sm:leading-7">
              {repository.description}
            </p>
          </div>
        )}
        <span className="absolute left-4 top-11 border border-border bg-background/90 px-2 py-1 font-mono text-[11px] text-muted backdrop-blur-sm sm:left-6">
          <span className="text-foreground">
            {lane === "fresh" ? "new" : lane === "wildcard" ? "deep cut" : "for you"}
          </span>
          <span className="mx-1.5 text-faint">·</span>
          {reason}
        </span>
      </div>

      <div className="flex min-h-0 flex-col justify-between gap-4 overflow-y-auto p-4 pb-5 sm:p-6 lg:pt-14">
        <div className="min-w-0">
          <Link href={detailHref} className="group block min-w-0">
            <span className="block truncate text-xs text-muted">{repository.owner}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-2xl font-semibold leading-tight tracking-[-0.03em] group-hover:text-muted sm:text-3xl">
              <span className="truncate">{repository.name}</span>
            </span>
          </Link>
          {showImage ? (
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted">{repository.description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Star size={13} weight="fill" />
              {compactNumber(repository.stars)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted">
              <GitFork size={13} />
              {compactNumber(repository.forks)}
            </span>
            <span className="text-muted">{ageLabel(repository.createdAt)}</span>
            <span className="font-sans font-medium" style={{ color: languageColor(repository.language) }}>
              {repository.language}
            </span>
            <span className="font-sans text-muted">{repository.license}</span>
          </div>
          {repository.topics.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {repository.topics.slice(0, 8).map((topic) => (
                <Link
                  key={topic}
                  href={`/explore?topic=${topic}`}
                  className="border border-border bg-surface px-2 py-1 text-xs text-muted hover:bg-subtle hover:text-foreground"
                >
                  {topicLabel(topic)}
                </Link>
              ))}
            </div>
          ) : null}

          <dl className="mt-6 hidden border-t border-border text-xs lg:block">
            {signalRows(repository).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-border py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {repository.homepage ? (
            <a
              href={repository.homepage}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
            >
              {hostnameOf(repository.homepage)}
              <ArrowSquareOut size={12} />
            </a>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <RepositoryReaction
              fullName={repository.fullName}
              initialCounts={reactionCounts}
              size="large"
              onReact={(reaction) => onSignal(reaction ?? "skip")}
            />
            <SaveRepositoryButton
              repository={repository}
              menuSide="left"
              className="button-secondary h-11 px-3 text-sm"
              onToggle={(added) => onSignal(added ? "save" : "skip")}
            />
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${repository.fullName} on GitHub`}
              className="button-ghost h-11 px-3 text-sm"
            >
              GitHub <ArrowSquareOut size={13} />
            </a>
          </div>
          <p className="hidden font-mono text-[11px] text-faint lg:block">
            <kbd className="border border-border px-1">j</kbd> next ·{" "}
            <kbd className="border border-border px-1">k</kbd> previous
          </p>
        </div>
      </div>
    </article>
  );
}

async function defaultFetchBatch(body: {
  taste: FeedTaste;
  exclude: string[];
}): Promise<FeedPayload> {
  const response = await fetch("/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 429) {
    throw new Error("Feed rate limit hit. Give it a minute.");
  }
  if (!response.ok) throw new Error("The feed could not load.");
  const payload = (await response.json()) as Partial<FeedPayload>;
  if (!Array.isArray(payload.items)) throw new Error("The feed returned nothing.");
  return {
    items: payload.items,
    seed: payload.seed ?? 0,
    source: payload.source ?? "index",
    reactionCounts: payload.reactionCounts ?? {},
  };
}
