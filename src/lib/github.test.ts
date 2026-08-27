import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildGitHubSearchQuery,
  getGitHubRepository,
  getGitHubRepositoryReadme,
  isPublicGitHubRepository,
  mapGitHubRepository,
  searchGitHubRepositories,
} from "@/lib/github";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/repositories";

const githubRepository = {
  id: 101,
  name: "forge",
  full_name: "northstar/forge",
  owner: { login: "northstar", avatar_url: "https://example.com/avatar.png" },
  description: "Build reproducible development environments",
  html_url: "https://github.com/northstar/forge",
  homepage: "https://forge.example.com",
  stargazers_count: 4200,
  forks_count: 310,
  open_issues_count: 42,
  watchers_count: 88,
  subscribers_count: 23,
  language: "Go",
  license: { spdx_id: "Apache-2.0" },
  topics: ["devtools", "containers"],
  created_at: "2025-04-01T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
  pushed_at: "2026-08-23T00:00:00Z",
  private: false,
};

describe("GitHub repository mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constrains discovery searches to public repositories", () => {
    expect(buildGitHubSearchQuery("terminal file manager")).toBe(
      "terminal file manager is:public",
    );
    expect(buildGitHubSearchQuery("rust is:public")).toBe("rust is:public");
    expect(buildGitHubSearchQuery('rust "is:public"')).toBe(
      'rust "is:public" is:public',
    );
    expect(buildGitHubSearchQuery("rust -is:public")).toBe(
      "rust -is:public is:public",
    );
    expect(buildGitHubSearchQuery("a".repeat(MAX_SEARCH_QUERY_LENGTH + 1))).toBe(
      `${"a".repeat(MAX_SEARCH_QUERY_LENGTH)} is:public`,
    );
  });

  it("identifies private GitHub payloads before mapping", () => {
    expect(isPublicGitHubRepository(githubRepository)).toBe(true);
    expect(
      isPublicGitHubRepository({ ...githubRepository, private: true }),
    ).toBe(false);
  });

  it("maps GitHub API fields to the Phlox repository model", () => {
    const repository = mapGitHubRepository(githubRepository);

    expect(repository.fullName).toBe("northstar/forge");
    expect(repository.stars).toBe(4200);
    expect(repository.license).toBe("Apache-2.0");
    expect(repository.avatarUrl).toBe("https://example.com/avatar.png");
    expect(repository.watchers).toBe(23);
    expect(repository.growthEstimated).toBe(true);
    expect(repository.contributorsEstimated).toBe(true);
  });

  it("uses readable fallbacks for nullable GitHub fields", () => {
    const repository = mapGitHubRepository({
      ...githubRepository,
      description: null,
      language: null,
      license: null,
      homepage: null,
    });

    expect(repository.description).toBe("No description provided.");
    expect(repository.language).toBe("Other");
    expect(repository.license).toBe("Not specified");
    expect(repository.homepage).toBeUndefined();
  });

  it("rejects unsafe repository homepage schemes", () => {
    const repository = mapGitHubRepository({
      ...githubRepository,
      homepage: "javascript:alert(document.domain)",
    });

    expect(repository.homepage).toBeUndefined();
  });

  it("filters private and malformed repositories from search responses", async () => {
    const privateRepository = {
      ...githubRepository,
      id: 102,
      full_name: "northstar/private-forge",
      private: true,
    };
    const missingVisibilityRepository: Partial<typeof githubRepository> = {
      ...githubRepository,
      id: 103,
      full_name: "northstar/unknown-forge",
    };
    delete missingVisibilityRepository.private;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              githubRepository,
              privateRepository,
              missingVisibilityRepository,
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const repositories = await searchGitHubRepositories("forge");

    expect(repositories.map((repository) => repository.fullName)).toEqual([
      "northstar/forge",
    ]);
  });

  it("registers every GitHub topic returned by search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [githubRepository] }), {
          status: 200,
        }),
      ),
    );
    const registerTopics = vi.fn().mockResolvedValue(undefined);

    await searchGitHubRepositories("forge", "relevance", 24, registerTopics);

    expect(registerTopics).toHaveBeenCalledWith("northstar/forge", [
      "devtools",
      "containers",
    ]);
  });

  it("returns null when a direct repository response is private", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ...githubRepository, private: true }),
          { status: 200 },
        ),
      ),
    );

    await expect(getGitHubRepository("northstar", "forge")).resolves.toBeNull();
  });

  it("loads README Markdown and resolves screenshot URLs", async () => {
    const markdown = [
      "# Forge",
      "![terminal preview](./docs/terminal.png)",
      '<img src="https://images.example.com/dashboard.webp" alt="Dashboard">',
      '<img src="https://github.com/northstar/forge/assets/123/abc-def" alt="Interface">',
      "![full screen](https://github.com/northstar/forge/blob/main/docs/full.png)",
      '<img src="https://github.com/warpdotdev/brand-assets/blob/main/Github/Sponsor/banner.png" alt="Available for macOS">',
      "![build badge](https://img.shields.io/badge/build-passing.svg)",
    ].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            content: Buffer.from(markdown).toString("base64"),
            encoding: "base64",
            path: "README.md",
            html_url: "https://github.com/northstar/forge/blob/main/README.md",
          }),
          { status: 200 },
        ),
      ),
    );

    const readme = await getGitHubRepositoryReadme("northstar", "forge");

    expect(readme?.content).toContain("# Forge");
    expect(readme?.screenshotUrls).toEqual([
      "https://raw.githubusercontent.com/northstar/forge/HEAD/docs/terminal.png",
      "https://images.example.com/dashboard.webp",
      "https://github.com/northstar/forge/assets/123/abc-def",
      "https://raw.githubusercontent.com/northstar/forge/main/docs/full.png",
    ]);
  });

  it("keeps best-match ordering for relevance but pools young repositories for rising", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [githubRepository] }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchGitHubRepositories("forge", "relevance");
    await searchGitHubRepositories("forge", "rising");
    await searchGitHubRepositories("forge created:>2020-01-01", "rising");
    await searchGitHubRepositories("forge", "trending");

    const [relevanceUrl, risingUrl, risingPinnedUrl, trendingUrl] =
      fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)));

    expect(relevanceUrl).not.toContain("sort=");
    expect(relevanceUrl).not.toContain("created:>");

    expect(risingUrl).toContain("sort=stars");
    expect(risingUrl).toContain("created:>");

    // A user-supplied created: qualifier is never overridden.
    expect(risingPinnedUrl).toContain("created:>2020-01-01");
    expect(risingPinnedUrl.match(/created:/g)).toHaveLength(1);

    expect(trendingUrl).toContain("pushed:>");
  });

  it("does not infer verification from a repository's star count", () => {
    const repository = mapGitHubRepository({
      ...githubRepository,
      stargazers_count: 100_000,
    });

    expect(repository.isVerified).toBe(false);
  });
});
