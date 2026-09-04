import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionsProvider } from "@/components/collections-provider";
import { DiscoveryFeed } from "@/components/discovery-feed";
import { TASTE_STORAGE_KEY } from "@/lib/feed-storage";
import type { FeedItem } from "@/lib/feed";
import { mockRepositories } from "@/lib/mock-data";

vi.mock("next/navigation", () => ({
  usePathname: () => "/feed",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

function item(index: number, lane: FeedItem["lane"] = "taste"): FeedItem {
  return {
    repository: mockRepositories[index],
    reason: "Rising in Terminal",
    lane,
    visual: null,
  };
}

const payload = (items: FeedItem[]) => ({
  items,
  seed: 1,
  source: "github" as const,
  reactionCounts: {},
});

describe("discovery feed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });

  it("renders the server batch as full-screen cards with actions", () => {
    render(
      <CollectionsProvider>
        <DiscoveryFeed initial={payload([item(0), item(1, "wildcard")])} />
      </CollectionsProvider>,
    );

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("uv");
    expect(cards[0]).toHaveTextContent("for you");
    expect(cards[1]).toHaveTextContent("deep cut");
    expect(screen.getByRole("button", { name: "Like astral-sh/uv" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open astral-sh/uv on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/astral-sh/uv",
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("learns taste from a like and persists it", async () => {
    render(
      <CollectionsProvider>
        <DiscoveryFeed initial={payload([item(0)])} />
      </CollectionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like astral-sh/uv" }));

    await waitFor(() =>
      expect(screen.getByTestId("taste-summary")).toHaveTextContent("Python"),
    );
    const stored = JSON.parse(window.localStorage.getItem(TASTE_STORAGE_KEY) || "{}");
    expect(stored.topics.python).toBe(2);
    expect(stored.languages.Rust).toBe(1);
  });

  it("sends taste and seen repositories when fetching the next batch", async () => {
    window.localStorage.setItem(
      TASTE_STORAGE_KEY,
      JSON.stringify({ topics: { tui: 4 }, languages: {} }),
    );
    const fetchBatch = vi.fn().mockResolvedValue(payload([item(5)]));
    render(
      <CollectionsProvider>
        <DiscoveryFeed initial={payload([item(0), item(1)])} fetchBatch={fetchBatch} />
      </CollectionsProvider>,
    );

    // Two cards is inside the prefetch window, so a fetch fires after hydration.
    await waitFor(() => expect(fetchBatch).toHaveBeenCalled());
    expect(fetchBatch).toHaveBeenCalledWith({
      taste: { topics: { tui: 4 }, languages: {} },
      exclude: [mockRepositories[0].fullName, mockRepositories[1].fullName],
    });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
  });

  it("loads a first batch on the client when the server had none", async () => {
    const fetchBatch = vi.fn().mockResolvedValue(payload([item(2)]));
    render(
      <CollectionsProvider>
        <DiscoveryFeed fetchBatch={fetchBatch} />
      </CollectionsProvider>,
    );
    await waitFor(() => expect(screen.getByRole("article")).toHaveTextContent("atuin"));
  });

  it("shows a retry when the batch fails", async () => {
    const fetchBatch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Feed rate limit hit. Give it a minute."))
      .mockResolvedValue(payload([item(3)]));
    render(
      <CollectionsProvider>
        <DiscoveryFeed fetchBatch={fetchBatch} />
      </CollectionsProvider>,
    );
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText("Feed rate limit hit. Give it a minute.")).toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByRole("article")).toHaveTextContent("ghostty");
  });

  it("resets taste and history", async () => {
    window.localStorage.setItem(
      TASTE_STORAGE_KEY,
      JSON.stringify({ topics: { tui: 4 }, languages: {} }),
    );
    const fetchBatch = vi.fn().mockResolvedValue(payload([item(4)]));
    render(
      <CollectionsProvider>
        <DiscoveryFeed initial={payload(mockRepositories.slice(0, 6).map((_, i) => item(i)))} fetchBatch={fetchBatch} />
      </CollectionsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("taste-summary")).toHaveTextContent("Terminal UIs"));

    fireEvent.click(screen.getByRole("button", { name: "Reset taste and start over" }));

    expect(window.localStorage.getItem(TASTE_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId("taste-summary")).not.toBeInTheDocument();
  });
});
