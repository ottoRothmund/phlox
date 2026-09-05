import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the bug that took every repository page down in production.
 *
 * Whether a route prerenders is decided during `next build`. The container
 * image is built without `.env.local` (it is in `.dockerignore`), so at build
 * time `GITHUB_TOKEN` and the Supabase config are absent, the `no-store`
 * Supabase fetch never runs, and Next marks the page static. The running
 * container HAS that config, so the same fetch does run — inside a static
 * render — and throws `DYNAMIC_SERVER_USAGE`. Every repo outside the
 * prerendered set returned 500, and the prerendered ones served data frozen
 * from a token-less build while the UI claimed to be live.
 *
 * `next build` cannot catch this: run locally with `.env.local` present the
 * routes come out dynamic and everything passes. The difference only appears
 * in an image built without secrets, which is the one that ships.
 *
 * Rule: a server page that reads live data renders per request. Freshness
 * comes from `next: { revalidate }` on the data fetches, not from freezing
 * the page.
 */

const appDir = path.join(process.cwd(), "src", "app");

/** Modules whose data is per-request live: GitHub search or shared Supabase state. */
const liveDataModules = [
  "@/lib/repository-service",
  "@/lib/phlox-data",
  "@/lib/github",
  "@/lib/site",
];

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "api" ? [] : pageFiles(full);
    }
    return entry === "page.tsx" || entry === "robots.ts" || entry === "sitemap.ts"
      ? [full]
      : [];
  });
}

describe("route rendering mode", () => {
  const files = pageFiles(appDir);

  it("finds the app routes", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files.map((file) => [path.relative(appDir, file), file]))(
    "%s renders per request if it reads live data",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const readsLiveData = liveDataModules.some((module) =>
        source.includes(`from "${module}"`),
      );
      if (!readsLiveData) return;

      expect(
        source.includes('export const dynamic = "force-dynamic"'),
        `${path.relative(
          appDir,
          file,
        )} reads live data, so it must export dynamic = "force-dynamic". ` +
          "Without it the route prerenders in a secret-less container build " +
          "and then throws DYNAMIC_SERVER_USAGE at run time.",
      ).toBe(true);
    },
  );

  it("no page ships a generateStaticParams list built from the fallback index", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("generateStaticParams")) continue;
      expect(
        source.includes("mockRepositories"),
        `${path.relative(appDir, file)} prerenders paths from the fallback ` +
          "index. Those pages bake index data into HTML that claims to be live.",
      ).toBe(false);
    }
  });
});
