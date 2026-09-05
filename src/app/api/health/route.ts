import { rateLimitCooldownSeconds } from "@/lib/github-limits";

/**
 * Liveness and readiness for whatever host ends up running this.
 *
 * Reports what is actually configured rather than a bare "ok", because the two
 * ways Phlox degrades in production are silent: a missing GITHUB_TOKEN drops
 * the search budget to 10 req/min for the whole site, and a missing Supabase
 * config turns off reactions, reviews, and sign-in without any visible error.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const github = Boolean(process.env.GITHUB_TOKEN);
  const supabase = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
  const supabaseWrites = supabase && Boolean(process.env.SUPABASE_WRITE_TOKEN);
  const siteUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());

  const searchCooldown = rateLimitCooldownSeconds("search");
  const coreCooldown = rateLimitCooldownSeconds("core");

  return Response.json(
    {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      config: { github, supabase, supabaseWrites, siteUrlConfigured },
      githubRateLimit: {
        // 0 means requests are flowing; a number means we are backing off.
        searchCooldownSeconds: searchCooldown,
        coreCooldownSeconds: coreCooldown,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
