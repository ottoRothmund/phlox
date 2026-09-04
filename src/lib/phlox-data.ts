export type RepositoryReactionValue = "like" | "dislike";

export interface ReactionCounts {
  likes: number;
  dislikes: number;
}

export interface ReactionState extends ReactionCounts {
  reaction: RepositoryReactionValue | null;
}

export interface TopicCatalogItem {
  slug: string;
  label: string;
  repositoryCount: number;
}

export interface RepositoryReview {
  id: string;
  fullName: string;
  displayName: string;
  kind: "comment" | "review";
  body: string;
  createdAt: string;
}

interface SupabaseConfig {
  url: string;
  key: string;
  writeToken?: string;
}

interface ReactionRow {
  repo_full_name: string;
  likes: number | string;
  dislikes: number | string;
  current_reaction?: RepositoryReactionValue | null;
}

interface TopicRow {
  topic_slug: string;
  repository_count: number | string;
}

interface ReviewRow {
  id: string;
  repo_full_name: string;
  display_name: string;
  kind: "comment" | "review";
  body: string;
  created_at: string;
}

const topicInitialisms = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["cli", "CLI"],
  ["css", "CSS"],
  ["gpu", "GPU"],
  ["html", "HTML"],
  ["ios", "iOS"],
  ["llm", "LLM"],
  ["ml", "ML"],
  ["sdk", "SDK"],
  ["ui", "UI"],
]);

function config(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const writeToken = process.env.SUPABASE_WRITE_TOKEN;
  return url && key ? { url, key, writeToken } : null;
}

function normalizeRepositoryName(fullName: string): string {
  return fullName.trim().toLocaleLowerCase();
}

function isRepositoryName(fullName: string): boolean {
  return (
    fullName.length >= 3 &&
    fullName.length <= 201 &&
    /^[^/\s]+\/[^/\s]+$/.test(fullName)
  );
}

function normalizedRepositoryName(fullName: string): string {
  const normalized = normalizeRepositoryName(fullName);
  if (!isRepositoryName(normalized)) {
    throw new Error("Invalid repository name.");
  }
  return normalized;
}

function normalizedTopics(topics: string[]): string[] {
  return [
    ...new Set(
      topics
        .map((topic) => topic.trim().toLocaleLowerCase())
        .filter(
          (topic) =>
            topic.length >= 1 &&
            topic.length <= 50 &&
            /^[a-z0-9][a-z0-9._+-]*$/.test(topic),
        ),
    ),
  ].slice(0, 20);
}

async function supabaseRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const currentConfig = config();
  if (!currentConfig) {
    throw new Error("Shared Phlox data is not configured.");
  }
  const isWrite = Boolean(init.method && init.method.toUpperCase() !== "GET");
  if (isWrite && !currentConfig.writeToken) {
    throw new Error("Shared Phlox write configuration is missing.");
  }

  const response = await fetch(`${currentConfig.url}/rest/v1/${endpoint}`, {
    cache: "no-store",
    ...init,
    headers: {
      apikey: currentConfig.key,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Shared Phlox data request failed with status ${response.status}.`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function topicLabel(slug: string): string {
  const normalized = slug.trim().toLocaleLowerCase();
  const initialism = topicInitialisms.get(normalized);
  if (initialism) return initialism;

  const words = normalized.replace(/[._+-]+/g, " ");
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

export async function getRepositoryReactionCounts(
  fullNames: string[],
): Promise<Record<string, ReactionCounts>> {
  const names = [...new Set(fullNames.map(normalizeRepositoryName))].filter(
    isRepositoryName,
  );
  const counts = Object.fromEntries(
    names.map((fullName) => [fullName, { likes: 0, dislikes: 0 }]),
  );
  if (names.length === 0 || !config()) return counts;

  const query = new URLSearchParams({
    select: "repo_full_name,likes,dislikes",
    repo_full_name: `in.(${names.map((name) => JSON.stringify(name)).join(",")})`,
  });
  const rows = await supabaseRequest<ReactionRow[]>(
    `repository_reaction_totals?${query.toString()}`,
  );

  for (const row of rows) {
    if (!(row.repo_full_name in counts)) continue;
    counts[row.repo_full_name] = {
      likes: Number(row.likes) || 0,
      dislikes: Number(row.dislikes) || 0,
    };
  }
  return counts;
}

export interface MostLikedRepository extends ReactionCounts {
  fullName: string;
}

/**
 * Repositories ordered by Phlox likes, most first. Only repositories with at
 * least one like appear; a list of zero-like rows is not a "most liked" list.
 */
export async function getMostLikedRepositories(
  limit = 30,
): Promise<MostLikedRepository[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    select: "repo_full_name,likes,dislikes",
    likes: "gt.0",
    order: "likes.desc,dislikes.asc,repo_full_name.asc",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const rows = await supabaseRequest<ReactionRow[]>(
    `repository_reaction_totals?${query.toString()}`,
  );
  return rows
    .filter((row) => isRepositoryName(row.repo_full_name))
    .map((row) => ({
      fullName: row.repo_full_name,
      likes: Number(row.likes) || 0,
      dislikes: Number(row.dislikes) || 0,
    }));
}

export async function setRepositoryReaction({
  fullName,
  visitorId,
  reaction,
}: {
  fullName: string;
  visitorId: string;
  reaction: RepositoryReactionValue | null;
}): Promise<ReactionState> {
  const currentConfig = config();
  const rows = await supabaseRequest<ReactionRow[]>(
    "rpc/set_repository_reaction",
    {
      method: "POST",
      body: JSON.stringify({
        p_repo_full_name: normalizedRepositoryName(fullName),
        p_visitor_id: visitorId,
        p_reaction: reaction,
        p_secret: currentConfig?.writeToken ?? null,
      }),
    },
  );
  const row = rows[0];
  if (!row) throw new Error("Reaction update returned no result.");

  return {
    likes: Number(row.likes) || 0,
    dislikes: Number(row.dislikes) || 0,
    reaction: row.current_reaction || null,
  };
}

export async function registerRepositoryTopics(
  fullName: string,
  topics: string[],
): Promise<void> {
  if (!config()) return;
  const currentConfig = config();
  await supabaseRequest<void>("rpc/register_repository_topics", {
    method: "POST",
    body: JSON.stringify({
      p_repo_full_name: normalizedRepositoryName(fullName),
      p_topics: normalizedTopics(topics),
      p_secret: currentConfig?.writeToken ?? null,
    }),
  });
}

export async function getTopicCatalog(limit = 18): Promise<TopicCatalogItem[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    select: "topic_slug,repository_count",
    order: "repository_count.desc,topic_slug.asc",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const rows = await supabaseRequest<TopicRow[]>(`topic_catalog?${query}`);
  return rows.map((row) => ({
    slug: row.topic_slug,
    label: topicLabel(row.topic_slug),
    repositoryCount: Number(row.repository_count) || 0,
  }));
}

function mapReview(row: ReviewRow): RepositoryReview {
  return {
    id: row.id,
    fullName: row.repo_full_name,
    displayName: row.display_name,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getRepositoryReviews(
  fullName: string,
  limit = 30,
): Promise<RepositoryReview[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    select: "id,repo_full_name,display_name,kind,body,created_at",
    repo_full_name: `eq.${normalizedRepositoryName(fullName)}`,
    order: "created_at.desc",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const rows = await supabaseRequest<ReviewRow[]>(`repository_reviews?${query}`);
  return rows.map(mapReview);
}

export async function createRepositoryReview({
  fullName,
  visitorId,
  displayName,
  kind,
  body,
}: {
  fullName: string;
  visitorId: string;
  displayName: string;
  kind: "comment" | "review";
  body: string;
}): Promise<RepositoryReview> {
  const currentConfig = config();
  const rows = await supabaseRequest<ReviewRow[]>(
    "rpc/create_repository_review",
    {
      method: "POST",
      body: JSON.stringify({
        p_repo_full_name: normalizedRepositoryName(fullName),
        p_visitor_id: visitorId,
        p_display_name: displayName.trim(),
        p_kind: kind,
        p_body: body.trim(),
        p_secret: currentConfig?.writeToken ?? null,
      }),
    },
  );
  const row = rows[0];
  if (!row) throw new Error("Review creation returned no result.");
  return mapReview(row);
}
