# Deploying Phlox

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `GITHUB_TOKEN` | strongly recommended | Fine-grained token, public repos read-only. Without it GitHub search allows 10 req/min and the site falls back to the index constantly. |
| `SUPABASE_URL` | for reactions, reviews, topics, sign-in | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | same | anon / publishable key |
| `SUPABASE_WRITE_TOKEN` | same | Random secret (32+ chars). Store the same value in the database: `insert into public.phlox_write_secret (secret) values ('<value>') on conflict (id) do update set secret = excluded.secret;` |
| `NEXT_PUBLIC_SITE_URL` | yes in production | e.g. `https://phlox.app`. Drives sitemap, robots, and OG URLs. |

Supabase: apply the three migrations in `supabase/migrations/` in order, then under Authentication → Providers enable GitHub and Google and add `<origin>/api/auth/callback` to the redirect allow-list.

## Vercel

```bash
vercel link --project phlox
vercel env add GITHUB_TOKEN production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_WRITE_TOKEN production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

## Fly.io (or any container host)

```bash
fly launch --no-deploy --copy-config --name phlox
fly secrets set GITHUB_TOKEN=... SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_WRITE_TOKEN=... NEXT_PUBLIC_SITE_URL=https://phlox.fly.dev
fly deploy
```

The `Dockerfile` builds a standalone Next.js server (`NEXT_OUTPUT=standalone`). Railway and Render pick it up automatically.

## Before flipping DNS

```bash
npm test && npm run lint && npm run typecheck && npm run build
curl -sI https://<origin>/explore | grep -iE "x-frame|strict-transport"
curl -s https://<origin>/robots.txt
curl -s "https://<origin>/api/github/search?q=rust&sort=forks" | head -c 300
```

Rate limits are in-memory per instance (`src/lib/rate-limit.ts`). On a multi-instance host they are per-instance, which is fine for abuse protection but not a hard global cap.
