import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { CollectionsProvider } from "@/components/collections-provider";
import { RepositoryList } from "@/components/repository-list";
import { RepositoryRow } from "@/components/repository-row";
import { mockRepositories } from "@/lib/mock-data";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("application shell", () => {
  it("renders primary navigation and page content", () => {
    render(
      <CollectionsProvider>
        <AppShell>
          <h1>Discovery</h1>
        </AppShell>
      </CollectionsProvider>,
    );

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary",
    });
    expect(within(primaryNavigation).getByRole("link", { name: "Explore" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(primaryNavigation).getByRole("link", { name: "Search" })).toBeInTheDocument();
    expect(
      within(primaryNavigation).getByRole("link", { name: "Collections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discovery" })).toBeInTheDocument();
  });

  it("focuses header search on '/' unless the visitor is already typing", () => {
    render(
      <CollectionsProvider>
        <AppShell>
          <textarea aria-label="Note" />
        </AppShell>
      </CollectionsProvider>,
    );
    const search = screen.getByRole("searchbox", { name: "Search repositories" });
    // jsdom has no layout, so offsetParent is null; the shortcut checks it to
    // skip the hidden mobile state. Pretend the input is laid out.
    Object.defineProperty(search, "offsetParent", { get: () => document.body });

    fireEvent.keyDown(window, { key: "/" });
    expect(search).toHaveFocus();

    const note = screen.getByLabelText("Note");
    note.focus();
    fireEvent.keyDown(note, { key: "/" });
    expect(note).toHaveFocus();
  });
});

describe("repository row", () => {
  it("shows repository identity, signals, and a detail link", () => {
    const repository = mockRepositories[0];
    render(
      <CollectionsProvider>
        <RepositoryRow repository={repository} rank={1} />
      </CollectionsProvider>,
    );

    expect(screen.getByText("uv")).toBeInTheDocument();
    expect(screen.getAllByText("astral-sh").length).toBeGreaterThan(0);
    expect(screen.getByText("Rust")).toHaveStyle({
      color: "var(--language-rust)",
    });
    expect(screen.getByText("+1,240 this week")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Like astral-sh/uv" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dislike astral-sh/uv" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /astral-sh\/uv/ })).toHaveAttribute(
      "href",
      "/repo/astral-sh/uv",
    );
  });

  it("passes batched shared reaction counts through repository lists", () => {
    const repository = mockRepositories[0];
    render(
      <CollectionsProvider>
        <RepositoryList
          repositories={[repository]}
          reactionCounts={{
            [repository.fullName]: { likes: 27, dislikes: 4 },
          }}
        />
      </CollectionsProvider>,
    );

    const reactions = screen.getByRole("group", {
      name: `React to ${repository.fullName}`,
    });
    expect(within(reactions).getByText("27")).toBeInTheDocument();
    expect(within(reactions).getByText("4")).toBeInTheDocument();
  });
});


