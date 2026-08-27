import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  RepositoryFilterRail,
  TopicBrowse,
} from "@/components/topic-navigation";
import { languageColor, mergeTopicCatalog } from "@/lib/repository-taxonomy";

const topics = [
  { slug: "terminal", label: "Terminal", repositoryCount: 18 },
  { slug: "ai", label: "AI", repositoryCount: 12 },
  { slug: "developer-tools", label: "Developer tools", repositoryCount: 9 },
];

describe("repository taxonomy", () => {
  it("merges newly discovered GitHub topics into browse topics", () => {
    expect(
      mergeTopicCatalog(
        [{ slug: "local-first", label: "Local first", repositoryCount: 4 }],
        topics,
        4,
      ).map((topic) => topic.slug),
    ).toEqual(["local-first", "terminal", "ai", "developer-tools"]);
  });

  it("returns readable language color tokens", () => {
    expect(languageColor("Rust")).toBe("var(--language-rust)");
    expect(languageColor("Go")).toBe("var(--language-go)");
    expect(languageColor("UnknownLang")).toBe("var(--language-other)");
  });
});

describe("topic navigation", () => {
  it("renders icon-led landing-page browse topics", () => {
    render(<TopicBrowse topics={topics} />);

    expect(screen.getByRole("link", { name: /Terminal/ })).toHaveAttribute(
      "href",
      "/explore?topic=terminal",
    );
    expect(screen.getByRole("link", { name: /AI/ })).toBeInTheDocument();
  });

  it("renders only curated topic groups with Terminal's nested children", async () => {
    const user = userEvent.setup();
    render(
      <RepositoryFilterRail
        topics={topics}
        languages={["Rust"]}
        topic=""
        language=""
        sort="rising"
        query=""
      />,
    );

    const filters = screen.getByRole("navigation", {
      name: "Repository filters",
    });
    // Curated groups appear; uncurated topics from the catalog do not.
    expect(within(filters).getByRole("link", { name: /Terminal/ })).toBeInTheDocument();
    expect(within(filters).queryByRole("link", { name: /Developer tools/ })).toBeInTheDocument();
    expect(within(filters).queryByText("Local first")).not.toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: /expand terminal/i }));

    expect(within(filters).getByRole("link", { name: /TUIs/ })).toHaveAttribute(
      "href",
      "/explore?topic=tui",
    );
    expect(within(filters).getByRole("link", { name: /Tools/ })).toHaveAttribute(
      "href",
      "/explore?topic=cli",
    );
  });

  it("expands and collapses an individual topic group", async () => {
    const user = userEvent.setup();
    render(
      <RepositoryFilterRail
        topics={topics}
        languages={["Rust"]}
        topic=""
        language=""
        sort="rising"
        query=""
      />,
    );

    // Groups start closed; the rail stays a short list of top-level topics.
    expect(screen.queryByRole("link", { name: /TUIs/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terminal/ })).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /expand terminal/i });
    await user.click(toggle);

    expect(screen.getByRole("link", { name: /TUIs/ })).toHaveAttribute(
      "href",
      "/explore?topic=tui",
    );
    expect(screen.getByRole("button", { name: /collapse terminal/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /collapse terminal/i }));
    expect(screen.queryByRole("link", { name: /TUIs/ })).not.toBeInTheDocument();
  });

  it("opens the group that holds the active topic", () => {
    render(
      <RepositoryFilterRail
        topics={topics}
        languages={["Rust"]}
        topic="tui"
        language=""
        sort="rising"
        query=""
      />,
    );

    expect(screen.getByRole("link", { name: /TUIs/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders Axiom-style grouped filters with active rows", () => {
    render(
      <RepositoryFilterRail
        topics={topics}
        languages={["Rust", "Go"]}
        topic="terminal"
        language="Rust"
        sort="rising"
        query=""
      />,
    );

    const filters = screen.getByRole("navigation", {
      name: "Repository filters",
    });
    expect(within(filters).getByRole("link", { name: /Terminal/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(filters).getByRole("link", { name: "Rust" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
