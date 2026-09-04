"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  CaretRight,
  Code,
  Coins,
  Database,
  FunnelSimple,
  HardDrives,
  LinuxLogo,
  ShieldCheck,
  Tag,
  TerminalWindow,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import type { TopicCatalogItem } from "@/lib/phlox-data";
import { topicLabel } from "@/lib/phlox-data";
import {
  languageColor,
  topicGroups,
  type TopicGroupChild,
} from "@/lib/repository-taxonomy";
import type { RepositorySort } from "@/lib/repositories";

function TopicIcon({ slug, size = 15 }: { slug: string; size?: number }) {
  const normalized = slug.toLocaleLowerCase();
  const Icon =
    /^(ai|llm|machine-learning|deep-learning)$/.test(normalized)
      ? Brain
      : /^(terminal|shell|cli)$/.test(normalized)
        ? TerminalWindow
        : /^(developer-tools|devtools|programming)$/.test(normalized)
          ? Code
          : normalized === "linux"
            ? LinuxLogo
            : /^(security|cybersecurity)$/.test(normalized)
              ? ShieldCheck
              : /^(database|distributed-systems|storage)$/.test(normalized)
                ? Database
                : normalized === "self-hosted"
                  ? HardDrives
                  : /^(defi|blockchain|ethereum)$/.test(normalized)
                    ? Coins
                    : Tag;
  return <Icon size={size} weight="regular" aria-hidden="true" />;
}

function TopicCount({ count }: { count?: number }) {
  return count && count > 0 ? (
    <span className="font-mono text-[10px] tabular-nums text-faint">
      {count}
    </span>
  ) : null;
}

function TopicGroupRows({
  group,
  counts,
  activeTopic,
  rowClass,
  filterHref,
}: {
  group: (typeof topicGroups)[number];
  counts: Map<string, number>;
  activeTopic: string;
  rowClass: string;
  filterHref: (key: "topic" | "language", value: string) => string;
}) {
  const childActive = group.children.some(
    (child: TopicGroupChild) => child.slug === activeTopic,
  );
  // Groups open when they hold the active topic, so a filtered page shows why.
  const [open, setOpen] = useState(childActive);
  const hasChildren = group.children.length > 0;
  const panelId = `topic-group-${group.slug}`;

  return (
    <div>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Collapse" : "Expand"} ${group.label}`}
            className="flex h-9 w-6 shrink-0 items-center justify-center text-muted hover:text-foreground"
          >
            <CaretRight
              size={12}
              aria-hidden="true"
              className={open ? "rotate-90 transition-transform" : "transition-transform"}
            />
          </button>
        ) : (
          <span className="h-9 w-6 shrink-0" aria-hidden="true" />
        )}
        <Link
          href={filterHref("topic", group.slug)}
          aria-current={activeTopic === group.slug || childActive ? "page" : undefined}
          className={rowClass}
        >
          <TopicIcon slug={group.slug} size={14} />
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
          <TopicCount count={counts.get(group.slug)} />
        </Link>
      </div>
      {hasChildren && open ? (
        <div id={panelId} className="relative ml-[25px] border-l border-border pl-2">
          {group.children.map((child: TopicGroupChild) => (
            <Link
              key={child.slug}
              href={filterHref("topic", child.slug)}
              aria-current={activeTopic === child.slug ? "page" : undefined}
              className={rowClass}
            >
              <span className="min-w-0 flex-1 truncate">{child.label}</span>
              <TopicCount count={counts.get(child.slug)} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopicBrowse({ topics }: { topics: TopicCatalogItem[] }) {
  return (
    <nav
      aria-label="Browse topics"
      className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-4 sm:px-6"
    >
      <span className="mr-2 shrink-0 self-center text-xs font-medium text-muted">
        Browse topics
      </span>
      {topics.map((topic) => (
        <Link
          key={topic.slug}
          href={`/explore?topic=${encodeURIComponent(topic.slug)}`}
          className="inline-flex shrink-0 items-center gap-2 border border-border bg-surface px-3 py-2 text-xs hover:border-muted hover:bg-subtle"
        >
          <TopicIcon slug={topic.slug} />
          <span>{topic.label}</span>
          {topic.repositoryCount > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-faint">
              {topic.repositoryCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function RepositoryFilterRail({
  topics,
  languages,
  topic,
  language,
  sort,
  query,
  minStars = 0,
  maxAgeDays = 0,
}: {
  topics: TopicCatalogItem[];
  languages: string[];
  topic: string;
  language: string;
  sort: RepositorySort;
  query: string;
  minStars?: number;
  maxAgeDays?: number;
}) {
  function filterHref(key: "topic" | "language", value: string): string {
    const next = new URLSearchParams();
    if (sort !== "rising") next.set("sort", sort);
    if (topic && key !== "topic") next.set("topic", topic);
    if (language && key !== "language") next.set("language", language);
    if (query) next.set("q", query);
    if (minStars > 0) next.set("stars", String(minStars));
    if (maxAgeDays > 0) next.set("age", String(maxAgeDays));
    if (value) next.set(key, value);
    return `/explore?${next.toString()}`;
  }

  const rowClass =
    "flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted hover:bg-subtle hover:text-foreground aria-[current=page]:bg-subtle aria-[current=page]:font-semibold aria-[current=page]:text-foreground";

  const counts = new Map(topics.map((item) => [item.slug, item.repositoryCount]));
  const activeSummary = [topic ? topicLabel(topic) : "", language]
    .filter(Boolean)
    .join(" · ");

  // On small screens the rail collapses to one line so results sit above
  // the fold; it opens automatically when a filter is active so the reason
  // for the narrowed list is visible. Desktop always shows it.
  const [open, setOpen] = useState(Boolean(topic || language));
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const sync = () => {
      if (desktop.matches) setOpen(true);
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="filter-rail group border border-border bg-surface lg:sticky lg:top-20"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold [&::-webkit-details-marker]:hidden lg:cursor-default lg:py-2">
        <FunnelSimple size={14} aria-hidden="true" />
        <span>Filters</span>
        {activeSummary ? (
          <span className="min-w-0 truncate font-normal text-muted" aria-live="polite">
            · {activeSummary}
          </span>
        ) : null}
        <CaretRight
          size={12}
          aria-hidden="true"
          className="ml-auto transition-transform group-open:rotate-90 lg:hidden"
        />
      </summary>
      <nav
        aria-label="Repository filters"
        className="max-h-[60dvh] overflow-y-auto border-t border-border p-2 lg:max-h-[calc(100dvh-8rem)]"
      >

      <section aria-labelledby="topic-filter-heading">
        <h2
          id="topic-filter-heading"
          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Topics
        </h2>
        <Link
          href={filterHref("topic", "")}
          aria-current={!topic ? "page" : undefined}
          className={rowClass}
        >
          <Tag size={14} aria-hidden="true" />
          All topics
        </Link>
        {topicGroups.map((group) => (
          <TopicGroupRows
            key={group.slug}
            group={group}
            counts={counts}
            activeTopic={topic}
            rowClass={rowClass}
            filterHref={filterHref}
          />
        ))}
      </section>

      <section className="mt-3 border-t border-border pt-2" aria-labelledby="language-filter-heading">
        <h2
          id="language-filter-heading"
          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Languages
        </h2>
        <Link
          href={filterHref("language", "")}
          aria-current={!language ? "page" : undefined}
          className={rowClass}
        >
          All languages
        </Link>
        <div className="relative ml-[19px] border-l border-border pl-2">
          {languages.map((item) => (
            <Link
              key={item}
              href={filterHref("language", item)}
              aria-current={language.toLocaleLowerCase() === item.toLocaleLowerCase() ? "page" : undefined}
              className={rowClass}
              style={{ color: languageColor(item) }}
            >
              {item}
            </Link>
          ))}
        </div>
      </section>
      </nav>
    </details>
  );
}