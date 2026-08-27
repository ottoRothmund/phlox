import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRepositoryReview,
  getRepositoryReactionCounts,
  getRepositoryReviews,
  getTopicCatalog,
  registerRepositoryTopics,
  setRepositoryReaction,
} from "@/lib/phlox-data";

const visitorId = "78cd25c0-79ef-4d09-a153-66f02f83ea11";

describe("shared Phlox data", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://phlox.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    vi.stubEnv("SUPABASE_WRITE_TOKEN", "server-write-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns aggregate reaction counts and zeroes missing repositories", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { repo_full_name: "northstar/forge", likes: 18, dislikes: 3 },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const counts = await getRepositoryReactionCounts([
      "northstar/forge",
      "northstar/trail",
    ]);

    expect(counts).toEqual({
      "northstar/forge": { likes: 18, dislikes: 3 },
      "northstar/trail": { likes: 0, dislikes: 0 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/rest/v1/repository_reaction_totals",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("persists one visitor reaction through the validated RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            repo_full_name: "northstar/forge",
            likes: 19,
            dislikes: 3,
            current_reaction: "like",
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await setRepositoryReaction({
      fullName: "northstar/forge",
      visitorId,
      reaction: "like",
    });

    expect(result).toEqual({ likes: 19, dislikes: 3, reaction: "like" });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      p_repo_full_name: "northstar/forge",
      p_visitor_id: visitorId,
      p_reaction: "like",
      p_secret: "server-write-token",
    });
  });

  it("refuses shared writes without the server write token", async () => {
    vi.stubEnv("SUPABASE_WRITE_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      setRepositoryReaction({
        fullName: "northstar/forge",
        visitorId,
        reaction: "like",
      }),
    ).rejects.toThrow("write configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers every normalized GitHub topic for a repository", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await registerRepositoryTopics("Northstar/Forge", [
      "Developer-Tools",
      "containers",
      "Developer-Tools",
    ]);

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      p_repo_full_name: "northstar/forge",
      p_topics: ["developer-tools", "containers"],
      p_secret: "server-write-token",
    });
  });

  it("turns the discovered topic registry into browse labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { topic_slug: "developer-tools", repository_count: 12 },
            { topic_slug: "ai", repository_count: 9 },
          ]),
          { status: 200 },
        ),
      ),
    );

    await expect(getTopicCatalog(12)).resolves.toEqual([
      { slug: "developer-tools", label: "Developer tools", repositoryCount: 12 },
      { slug: "ai", label: "AI", repositoryCount: 9 },
    ]);
  });

  it("creates and reads bounded public comments and reviews", async () => {
    const review = {
      id: "a3464fb1-a1bc-47ef-9b24-f5877b5a229b",
      repo_full_name: "northstar/forge",
      display_name: "Mina",
      kind: "review",
      body: "Fast setup and unusually clear documentation.",
      created_at: "2026-08-24T12:00:00Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([review]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([review]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createRepositoryReview({
        fullName: "northstar/forge",
        visitorId,
        displayName: " Mina ",
        kind: "review",
        body: " Fast setup and unusually clear documentation. ",
      }),
    ).resolves.toMatchObject({
      displayName: "Mina",
      kind: "review",
    });

    await expect(getRepositoryReviews("northstar/forge")).resolves.toEqual([
      {
        id: review.id,
        fullName: "northstar/forge",
        displayName: "Mina",
        kind: "review",
        body: review.body,
        createdAt: review.created_at,
      },
    ]);
  });
});
