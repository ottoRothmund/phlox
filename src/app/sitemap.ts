import type { MetadataRoute } from "next";

import { mockRepositories } from "@/lib/mock-data";
import { topicGroups } from "@/lib/repository-taxonomy";
import { siteUrl } from "@/lib/site";

/**
 * Rendered per request. Same reason as `robots.ts`: prerendering freezes
 * `NEXT_PUBLIC_SITE_URL` at build time, and on a container host the origin is
 * only known at run time. A sitemap full of localhost URLs is worse than none.
 */
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const at = (path: string) => new URL(path, origin).toString();
  const now = new Date();

  const topics = topicGroups.flatMap((group) => [
    group.slug,
    ...group.children.map((child) => child.slug),
  ]);

  return [
    { url: at("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: at("/explore"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: at("/feed"), lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: at("/search"), lastModified: now, changeFrequency: "daily", priority: 0.6 },
    ...topics.map((slug) => ({
      url: at(`/explore?topic=${encodeURIComponent(slug)}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...mockRepositories.map((repository) => ({
      url: at(`/repo/${repository.owner}/${repository.name}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
  ];
}
