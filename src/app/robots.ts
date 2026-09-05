import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * Rendered per request, not at build time.
 *
 * `NEXT_PUBLIC_SITE_URL` is a runtime variable on every container host: the
 * image is built once and the origin is supplied when it starts. Prerendering
 * this route bakes in whatever origin happened to be set during `next build`
 * — which is localhost — and ships a sitemap pointer no crawler can follow.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
