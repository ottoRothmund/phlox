import { getGitHubRepositoryReadme } from "@/lib/github";
import type { FeedVisual } from "@/lib/feed";

const githubImageHosts = [
  "repository-images.githubusercontent.com",
  "opengraph.githubassets.com",
];

export function parseSocialImage(html: string): string | null {
  const match =
    html.match(/property="og:image"\s+content="([^"]+)"/) ||
    html.match(/content="([^"]+)"\s+property="og:image"/);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    if (url.protocol !== "https:") return null;
    // The generic auto-generated card is just the avatar plus stats — not a
    // visual worth filling a screen with. Only uploaded social previews count.
    if (url.hostname === "opengraph.githubassets.com") return null;
    return githubImageHosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchSocialImage(
  owner: string,
  name: string,
): Promise<string | null> {
  const response = await fetch(
    `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    {
      headers: { "User-Agent": "phlox-discovery", Accept: "text/html" },
      next: { revalidate: 86_400 },
    },
  );
  if (!response.ok) return null;
  // The og tags sit in <head>; no need to buffer half a megabyte of HTML.
  const head = (await response.text()).slice(0, 60_000);
  return parseSocialImage(head);
}

/**
 * Best available image for a repository card: the first README screenshot,
 * else an uploaded social preview. Null when neither exists, in which case
 * the card falls back to typography.
 */
export async function resolveRepositoryVisual(
  owner: string,
  name: string,
  deps: {
    readme?: typeof getGitHubRepositoryReadme;
    social?: typeof fetchSocialImage;
  } = {},
): Promise<FeedVisual | null> {
  const readme = deps.readme ?? getGitHubRepositoryReadme;
  const social = deps.social ?? fetchSocialImage;

  const screenshot = await readme(owner, name)
    .then((result) => result?.screenshotUrls[0] ?? null)
    .catch(() => null);
  if (screenshot) return { url: screenshot, kind: "screenshot" };

  const socialImage = await social(owner, name).catch(() => null);
  return socialImage ? { url: socialImage, kind: "social" } : null;
}
