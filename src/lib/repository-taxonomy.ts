import type { TopicCatalogItem } from "@/lib/phlox-data";

const languageTokens = new Map([
  ["c", "c"],
  ["c#", "csharp"],
  ["c++", "cpp"],
  ["css", "css"],
  ["dart", "dart"],
  ["elixir", "elixir"],
  ["go", "go"],
  ["haskell", "haskell"],
  ["html", "html"],
  ["java", "java"],
  ["javascript", "javascript"],
  ["kotlin", "kotlin"],
  ["lua", "lua"],
  ["nix", "nix"],
  ["php", "php"],
  ["python", "python"],
  ["ruby", "ruby"],
  ["rust", "rust"],
  ["scala", "scala"],
  ["shell", "shell"],
  ["swift", "swift"],
  ["typescript", "typescript"],
  ["zig", "zig"],
]);

export function languageColor(language: string): string {
  const token = languageTokens.get(language.trim().toLocaleLowerCase()) || "other";
  return `var(--language-${token})`;
}

/**
 * GitHub's SPDX ids include two placeholders that read as noise in a list:
 * NOASSERTION (a custom license file) and our own "Not specified". Show
 * "Custom license" for the first and nothing for the second.
 */
export function licenseLabel(license: string): string {
  const normalized = license.trim();
  if (!normalized || /^not specified$/i.test(normalized)) return "";
  if (/^noassertion$/i.test(normalized)) return "Custom license";
  return normalized;
}

export function mergeTopicCatalog(
  discovered: TopicCatalogItem[],
  fallback: TopicCatalogItem[],
  limit = 18,
): TopicCatalogItem[] {
  const merged = new Map<string, TopicCatalogItem>();
  for (const topic of [...discovered, ...fallback]) {
    if (!merged.has(topic.slug)) merged.set(topic.slug, topic);
  }
  return [...merged.values()].slice(0, limit);
}

export interface TopicGroupChild {
  slug: string;
  label: string;
}

export interface TopicGroup {
  slug: string;
  label: string;
  children: TopicGroupChild[];
}

// Curated top-level filter groups. The rail shows only these; anything else
// GitHub discovers stays reachable through search instead of crowding the list.
export const topicGroups: TopicGroup[] = [
  {
    slug: "terminal",
    label: "Terminal",
    children: [
      { slug: "tui", label: "TUIs" },
      { slug: "cli", label: "Tools" },
    ],
  },
  {
    slug: "ai",
    label: "AI",
    children: [
      { slug: "llm", label: "LLMs" },
      { slug: "machine-learning", label: "Machine learning" },
    ],
  },
  { slug: "developer-tools", label: "Developer tools", children: [] },
  { slug: "self-hosted", label: "Self-hosted", children: [] },
  { slug: "security", label: "Security", children: [] },
];
