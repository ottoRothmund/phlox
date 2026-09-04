# Phlox

Phlox is a modern discovery platform for GitHub repositories. It focuses on rising projects, useful niches, topic exploration, related repositories, personal reactions, and collections.

## Feed

`/feed` is a full-screen, one-repository-at-a-time feed. Each card shows the best available visual (first README screenshot, else an uploaded social preview, else oversized type), the repository's real signals, and Like / Dislike / Save.

Every batch is built from three GitHub searches:

- **for you** — a topic weighted by what you liked, ranked by relative star velocity.
- **deep cut** — a random topic from a curated pool, restricted to a random 90-day creation window and a 40–4000 star band. Good projects that never hit the front page.
- **new** — repositories created in the last month, in a seeded 12-day window.

Taste is a small weight map over topics and languages, stored in `localStorage` (`phlox.feed.taste.v1`). Likes add +2, saves +3, dislikes −1.5, and scrolling past a card after dwelling on it for over a second is −0.15. Nothing about your taste leaves the browser except the current weights sent with each `POST /api/feed`. Reset clears everything.

Keyboard: `↓`/`j` next, `↑`/`k` previous.

## Stack

- Next.js 16 with the App Router and React Server Components
- React 19 and TypeScript
- Tailwind CSS 4 with semantic theme tokens
- Phosphor icons
- Vitest and Testing Library
- GitHub REST API with a curated local fallback index

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

GitHub search works without authentication, but the public rate limit is low. Copy `.env.example` to `.env.local` and add a fine-grained GitHub token for higher limits:

```bash
cp .env.example .env.local
```

Do not commit `.env.local`.

## Quality gates

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Project structure

```text
src/app/          Routes, layouts, loading, error, and API handlers
src/components/   Reusable interface and client interaction components
src/lib/          GitHub adapters, repository ranking, mock index, collections
src/test/         Shared test setup
```

## Data behavior

- Search queries use the GitHub REST API on the server.
- API failures and rate limits fall back to the typed local discovery index.
- Explore feeds use deterministic local signals so the first version remains stable.
- Likes, dislikes, and collections are persisted in browser local storage.
- `GET /api/github/search?q=rust&sort=rising` exposes the same search service as JSON. Optional `stars` (100, 1000, 10000) and `age` (7, 30, 365 days) filters apply to every sort.
- `POST /api/feed` with `{ taste, exclude, seed }` returns one feed batch. Rate-limited to 8 batches/minute globally with a token (3 without), since each batch is three GitHub searches.

## Sorting

Explore and Search share one sort list (`sortOptions` in `src/lib/repositories.ts`):

| Sort | How it works |
| --- | --- |
| Rising | Weekly star growth relative to prior size, with a Bayesian prior and mega-repo demotion |
| Trending | Absolute weekly growth dampened by sqrt of prior size |
| Most starred | GitHub `sort=stars` |
| Most forked | GitHub `sort=forks` |
| Most liked | Phlox likes, then net score (likes − dislikes), then stars. With no query it lists the repositories liked most on Phlox, hydrated live from GitHub. With a query it reranks the GitHub pool by reaction totals. |
| Newest | GitHub cannot sort by creation date, so this fetches a star-ordered pool created in the last 60 days and sorts by `created_at` locally |
| Recently active | GitHub `sort=updated` |
| Best match | GitHub's own ranking, search only |

Locally reranked sorts fetch a 2× pool (max 60) so there is something to reorder beyond GitHub's top-N. Collections have their own client-side sort (saved order, stars, forks, newest, active, name).

The local index contains realistic public repository metadata and clearly identifies itself in the interface as a curated index.