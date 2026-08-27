import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionsProvider } from "@/components/collections-provider";
import { CollectionsView } from "@/components/collections-view";
import { SaveRepositoryButton } from "@/components/save-repository-button";
import { mockRepositories } from "@/lib/mock-data";

const liveRepository = {
  ...mockRepositories[0],
  id: 99_001,
  owner: "facebook",
  name: "react",
  fullName: "facebook/react",
  description: "The library for web and native user interfaces.",
};

describe("collections view", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a personal collection from the inline form", () => {
    render(
      <CollectionsProvider>
        <CollectionsView />
      </CollectionsProvider>,
    );

    fireEvent.change(screen.getByLabelText("Collection name"), {
      target: { value: "Unusual software" },
    });
    fireEvent.change(screen.getByLabelText("Collection description"), {
      target: { value: "Odd and delightful projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create collection" }));

    expect(screen.getByRole("heading", { name: "Unusual software" })).toBeInTheDocument();
    expect(screen.getByText("Odd and delightful projects")).toBeInTheDocument();
  });

  it("persists and renders a live GitHub repository after saving it", async () => {
    const { unmount } = render(
      <CollectionsProvider>
        <SaveRepositoryButton repository={liveRepository} />
        <CollectionsView />
      </CollectionsProvider>,
    );

    fireEvent.click(
      screen.getByLabelText("Save facebook/react to a collection"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Daily drivers" }));

    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem("phlox.collections.v1") ?? "[]",
        )[0].repositorySnapshots,
      ).toContainEqual(liveRepository),
    );

    unmount();
    render(
      <CollectionsProvider>
        <CollectionsView />
      </CollectionsProvider>,
    );

    expect(
      await screen.findByRole("link", { name: /facebook\/react/ }),
    ).toHaveAttribute("href", "/repo/facebook/react");
  });

  it("falls back to starter collections when stored data is malformed", () => {
    window.localStorage.setItem(
      "phlox.collections.v1",
      JSON.stringify([{ id: "broken", repoFullNames: null }]),
    );

    render(
      <CollectionsProvider>
        <CollectionsView />
      </CollectionsProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Daily drivers" }),
    ).toBeInTheDocument();
  });

  it("keeps collections usable when localStorage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    render(
      <CollectionsProvider>
        <CollectionsView />
      </CollectionsProvider>,
    );
    fireEvent.change(screen.getByLabelText("Collection name"), {
      target: { value: "Offline list" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create collection" }));

    expect(
      screen.getByRole("heading", { name: "Offline list" }),
    ).toBeInTheDocument();
  });
});
