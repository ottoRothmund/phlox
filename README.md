# Phlox

Phlox is a modern discovery platform for GitHub repositories. It focuses on rising projects, useful niches, topic exploration, related repositories, personal reactions, and collections.

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
- `GET /api/github/search?q=rust&sort=rising` exposes the same search service as JSON.

The local index contains realistic public repository metadata and clearly identifies itself in the interface as a curated index.